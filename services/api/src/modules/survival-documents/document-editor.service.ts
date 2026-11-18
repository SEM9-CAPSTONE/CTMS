import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { chunkConfiguration } from "../knowledge-chunks/knowledge-chunks.types";
import {
	type EditAction,
	type EditorSection,
	type ExtractedSection,
	sourceSections,
} from "./document-editor.policy";
import { invalidSource } from "./dto/source.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
import { isEligibleSourceContent } from "./source-policy";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsRepository, sourceConflict } from "./survival-documents.repository";
import {
	DocumentStatus,
	type SourceVersion,
} from "./survival-documents.types";

export interface EditorSnapshot {
	title: string;
	baseTitle: string;
	baseChecksum: string;
	baseSections: EditorSection[];
	sections: EditorSection[];
	changes: Array<{ action: EditAction; heading: string; version?: number; position?: number }>;
	reviewBasis?: string;
}

export interface EditDraft {
	id: string;
	baseVersionId: string;
	baseRevision: number;
	revision: number;
	snapshot: EditorSnapshot;
	confirmedRevision: number | null;
	materializedVersionId: string | null;
}

const draftSelect = `SELECT id,base_version_id AS "baseVersionId",base_revision AS "baseRevision",
	revision,snapshot,confirmed_revision AS "confirmedRevision",materialized_version_id AS "materializedVersionId"
	FROM survival_document_edit_drafts`;
const MAX_EDITOR_BYTES = 2 * 1024 * 1024;

@Injectable()
export class DocumentEditorService {
	constructor(
		private readonly repo: SurvivalDocumentsRepository,
		private readonly files: SourceFilesService,
	) {}

	async begin(actor: string, documentId: string, expectedRevision: number) {
		const document = await this.repo.document(this.repo.db.manager, documentId);
		if (document.revision !== expectedRevision) sourceConflict();
		if (!document.currentPublishedVersionId)
			throw invalidSource("Tài liệu chưa có phiên bản hiện hành.");
		const version = await this.repo.version(
			this.repo.db.manager,
			documentId,
			document.currentPublishedVersionId
		);
		const args = [documentId, version.id, actor, expectedRevision];
		const where =
			"WHERE document_id=$1 AND base_version_id=$2 AND created_by=$3 AND base_revision=$4";
		const [existing]: EditDraft[] = await this.repo.db.query(`${draftSelect} ${where}`, args);
		if (existing?.baseRevision === expectedRevision) return existing;
		const sections = await this.extract(version);
		return this.repo.db.transaction(async (manager) => {
			const current = await this.repo.document(manager, documentId, true);
			if (current.revision !== expectedRevision || current.currentPublishedVersionId !== version.id)
				sourceConflict();
			const snapshot: EditorSnapshot = {
				title: version.metadata.sourceTitle,
				baseTitle: version.metadata.sourceTitle,
				baseChecksum: version.checksum,
				baseSections: sections,
				sections,
				changes: [],
			};
			const added: Array<{ id: string }> = await manager.query(
				`INSERT INTO survival_document_edit_drafts(document_id,base_version_id,created_by,base_revision,snapshot)
				VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(document_id,base_version_id,base_revision,created_by) DO NOTHING RETURNING id`,
				[...args, JSON.stringify(snapshot)]
			);
			const [saved]: EditDraft[] = await manager.query(`${draftSelect} ${where}`, args);
			if (added.length)
				await manager.query(
					`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"after")
				VALUES($1,'survival_document.edit_begin','survival_document',$2,$3::jsonb)`,
					[actor, documentId, JSON.stringify({ draftId: saved.id, baseVersionId: version.id })]
				);
			return saved;
		});
	}

	async historical(documentId: string, versionId: string) {
		const version = await this.repo.version(this.repo.db.manager, documentId, versionId);
		return this.extract(version);
	}

	async preview(actor: string, documentId: string, draftId: string) {
		return this.read(this.repo.db.manager, actor, documentId, draftId);
	}

	private async read(
		manager: EntityManager,
		actor: string,
		documentId: string,
		id: string
	): Promise<EditDraft> {
		const [draft]: EditDraft[] = await manager.query(
			`${draftSelect} WHERE document_id=$1 AND id=$2 AND created_by=$3`,
			[documentId, id, actor]
		);
		if (!draft) throw new NotFoundException({ message: "Không tìm thấy bản nháp biên tập." });
		return draft;
	}

	private async extract(version: SourceVersion) {
		if (
			![DocumentStatus.PUBLISHED, DocumentStatus.SUPERSEDED, DocumentStatus.ARCHIVED].includes(
				version.status
			) ||
			!isEligibleSourceContent(version)
		)
			throw invalidSource("Phiên bản này chưa đủ điều kiện để đọc nội dung biên tập.");
		const bytes = await this.files.read(version);
		const response = await this.post("extract", {
			document_version_id: version.id,
			source_version: version.versionNumber,
			title: version.metadata.sourceTitle,
			checksum: version.checksum,
			locale: version.metadata.locale,
			configuration: chunkConfiguration(),
			pdf_base64: bytes.toString("base64"),
		});
		const json = await response.text();
		if (Buffer.byteLength(json, "utf8") > MAX_EDITOR_BYTES / 3)
			throw invalidSource(
				"PDF có quá nhiều nội dung để biên tập trực tiếp. Hãy dùng tệp hoặc URL PDF."
			);
		const sections = JSON.parse(json) as ExtractedSection[];
		if (
			!Array.isArray(sections) ||
			!sections.length ||
			sections.length > 200 ||
			sections.some(
				(section) =>
					!section ||
					typeof section.heading !== "string" ||
					!section.heading.trim() ||
					!Array.isArray(section.pages) ||
					!section.pages.length ||
					section.pages.some((page) => !Number.isInteger(page) || page < 1) ||
					!Array.isArray(section.item_refs) ||
					!section.item_refs.length ||
					section.item_refs.some((ref) => typeof ref !== "string" || !ref) ||
					!Array.isArray(section.items) ||
					!section.items.length ||
					section.items.length !== section.item_refs.length ||
					section.items.some(
						(item) =>
							!item ||
							!["heading", "paragraph", "list", "table"].includes(item.kind) ||
							typeof item.text !== "string" ||
							!Array.isArray(item.rows) ||
							item.rows.some(
								(row) => !Array.isArray(row) || row.some((cell) => typeof cell !== "string")
							)
					)
			)
		)
			throw invalidSource("Không thể xác thực cấu trúc và vị trí của các mục trong PDF.");
		return sourceSections(sections, version);
	}

	private async post(path: "extract", body: object): Promise<Response> {
		const token = process.env.KNOWLEDGE_SERVICE_TOKEN;
		const unavailable = () =>
			new ServiceUnavailableException({
				message: "Dịch vụ xử lý tài liệu chưa sẵn sàng. Vui lòng thử lại.",
			});
		if (!token) throw unavailable();
		const url = process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:8001";
		const response = await fetch(`${url}/document-editor/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(600_000),
		}).catch(() => {
			throw unavailable();
		});
		if (response.status === 422)
			throw invalidSource(
				"Không thể đọc cấu trúc PDF đủ tin cậy. Hãy dùng tệp PDF hoặc URL mới."
			);
		if (!response.ok) throw unavailable();
		return response;
	}
}
