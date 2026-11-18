import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { chunkConfiguration } from "../knowledge-chunks/knowledge-chunks.types";
import {
	EditAction,
	type EditOperation,
	type EditorSection,
	type ExtractedSection,
	applyEditorOperations,
	assertAdaptationGrants,
	fingerprint,
	oneSection,
	sourceSections,
	versionAttribution,
} from "./document-editor.policy";
import type {
	ConfirmDocumentEditDto,
	EditorRevisionDto,
	PlanDocumentEditDto,
} from "./dto/document-editor.dto";
import { invalidSource } from "./dto/source.dto";
import { sourceMaxBytes, validatePdf } from "./pdf-file-validator";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
import { isEligibleSourceContent } from "./source-policy";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsRepository, sourceConflict } from "./survival-documents.repository";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsService } from "./survival-documents.service";
import {
	DocumentStatus,
	type SourceMetadata,
	type SourceVersion,
	VERSION_SELECT,
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
		private readonly documents: SurvivalDocumentsService
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

	async lineage(documentId: string, versionId: string) {
		await this.repo.version(this.repo.db.manager, documentId, versionId);
		const [draft]: EditDraft[] = await this.repo.db.query(
			`${draftSelect} WHERE document_id=$1 AND materialized_version_id=$2`,
			[documentId, versionId]
		);
		if (!draft) throw new NotFoundException({ message: "Phiên bản này không có hồ sơ biên soạn." });
		return {
			baseVersionId: draft.baseVersionId,
			reviewBasis: draft.snapshot.reviewBasis,
			sections: draft.snapshot.sections.map(
				({ heading, source, pages, item_refs, fingerprint, edited }) => ({
					heading,
					source,
					pages,
					item_refs,
					fingerprint,
					edited: edited === true,
				})
			),
		};
	}

	async plan(actor: string, documentId: string, draftId: string, dto: PlanDocumentEditDto) {
		const draft = await this.preview(actor, documentId, draftId);
		const changeHash = fingerprint(["plan", dto]);
		if (await this.replayed(this.repo.db.manager, draftId, dto.requestId, changeHash)) return draft;
		if (draft.revision !== dto.expectedRevision || draft.materializedVersionId) sourceConflict();
		const history = new Map<string, EditorSection[]>();
		const interpreted = dto.instruction?.trim()
			? await this.interpret(documentId, draft.snapshot.sections, dto.instruction, history)
			: undefined;
		const operations = interpreted?.operations ?? dto.operations ?? [];
		if (dto.instruction?.trim() && dto.operations?.length)
			throw invalidSource(
				"Hãy dùng yêu cầu bằng văn bản hoặc thao tác theo mục trong mỗi lần lưu."
			);
		for (const versionId of new Set(
			operations.flatMap((op) => (op.fromVersionId ? [op.fromVersionId] : []))
		)) {
			if (!history.has(versionId))
				history.set(versionId, await this.historical(documentId, versionId));
		}
		const sections =
			interpreted?.sections ?? applyEditorOperations(draft.snapshot.sections, operations, history);
		const title = dto.title === undefined ? draft.snapshot.title : dto.title.trim();
		if (title.length < 2) throw invalidSource("Hãy nhập tên tài liệu.");
		const changes = [
			...draft.snapshot.changes,
			...operations.map((op) => ({
				action: op.action,
				heading:
					op.heading ||
					history.get(op.fromVersionId ?? "")?.find((section) => section.id === op.fromSectionId)
						?.heading ||
					draft.snapshot.sections.find((section) => section.id === op.targetId)?.heading ||
					"",
				version: history.get(op.fromVersionId ?? "")?.[0]?.source?.versionNumber,
				position: op.position,
			})),
		];
		if (changes.length > 500) throw invalidSource("Bản nháp đã đạt giới hạn số lần thay đổi.");
		return this.update(
			actor,
			documentId,
			draftId,
			dto,
			changeHash,
			{ ...draft.snapshot, title, sections, changes, reviewBasis: undefined },
			false,
			dto.instruction?.trim() ? "edit_proposal" : "edit_update"
		);
	}

	async confirm(actor: string, documentId: string, draftId: string, dto: ConfirmDocumentEditDto) {
		const draft = await this.preview(actor, documentId, draftId);
		const reviewBasis = dto.reviewBasis.trim();
		if (reviewBasis.length < 10)
			throw invalidSource("Hãy ghi căn cứ kiểm tra nội dung và điều kiện áp dụng.");
		const { snapshot } = draft;
		if (
			snapshot.title === snapshot.baseTitle &&
			fingerprint(snapshot.sections) === fingerprint(snapshot.baseSections)
		)
			throw invalidSource("Hãy điều chỉnh ít nhất một mục trước khi xác nhận.");
		return this.update(
			actor,
			documentId,
			draftId,
			dto,
			fingerprint(["confirm", dto]),
			{ ...draft.snapshot, reviewBasis },
			true,
			"edit_confirm"
		);
	}

	async commit(actor: string, documentId: string, draftId: string, dto: EditorRevisionDto) {
		const draft = await this.preview(actor, documentId, draftId);
		const changeHash = fingerprint(["commit", dto]);
		if (draft.materializedVersionId) {
			if (!(await this.replayed(this.repo.db.manager, draftId, dto.requestId, changeHash)))
				sourceConflict();
			return {
				document: await this.documents.detail(documentId),
				versionId: draft.materializedVersionId,
			};
		}
		if (draft.revision !== dto.expectedRevision || draft.confirmedRevision !== draft.revision)
			sourceConflict();
		const { title, sections, baseChecksum, reviewBasis } = draft.snapshot;
		const checksums = [
			...new Set([
				baseChecksum,
				...sections.flatMap((section) => (section.source ? [section.source.checksum] : [])),
			]),
		];
		assertAdaptationGrants(checksums);
		const base = await this.repo.version(this.repo.db.manager, documentId, draft.baseVersionId);
		const response = await this.post("compose", {
			title,
			sections: sections.map(({ heading, items }) => ({ heading, items })),
		});
		if (Number(response.headers.get("content-length")) > sourceMaxBytes())
			throw invalidSource("Tệp PDF vượt quá dung lượng cho phép.");
		const bytes = Buffer.from(await response.arrayBuffer());
		const filename = `CTMS-bien-soan-${base.versionNumber + 1}-${fingerprint([draftId, draft.revision]).slice(0, 12)}.pdf`;
		const pdf = { ...(await validatePdf(bytes, filename)), bytes };
		const metadata: SourceMetadata = {
			sourceTitle: title,
			publisher: "CTMS",
			classification: base.metadata.classification,
			locale: base.metadata.locale,
			adaptationDisclaimer: versionAttribution,
			attribution: versionAttribution,
			licenseType: "Quyền biên soạn nội bộ",
			changeSummary: reviewBasis,
			permissionEvidence:
				"Đã xác nhận quyền biên soạn nội bộ cho đúng các PDF nguồn trong hồ sơ biên soạn.",
		};
		const document = await this.documents
			.storeComposedDraft(
				actor,
				documentId,
				draft.baseRevision,
				metadata,
				pdf,
				async (manager, versionId) => {
					const current = await this.read(manager, actor, documentId, draftId);
					if (
						current.revision !== dto.expectedRevision ||
						current.confirmedRevision !== current.revision ||
						current.materializedVersionId
					)
						sourceConflict();
					assertAdaptationGrants(checksums);
					await manager.query(
						"UPDATE survival_document_edit_drafts SET materialized_version_id=$2 WHERE id=$1",
						[draftId, versionId]
					);
					await this.record(manager, draftId, dto.requestId, changeHash);
				}
			)
			.catch(async (error: unknown) => {
				if (!(await this.replayed(this.repo.db.manager, draftId, dto.requestId, changeHash)))
					throw error;
				return this.documents.detail(documentId);
			});
		const saved = await this.preview(actor, documentId, draftId);
		return { document, versionId: saved.materializedVersionId };
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

	private async replayed(
		manager: EntityManager,
		draftId: string,
		key: string,
		hash: string
	): Promise<boolean> {
		const [row]: Array<{ fingerprint: string }> = await manager.query(
			"SELECT fingerprint FROM survival_document_edit_requests WHERE draft_id=$1 AND request_id=$2",
			[draftId, key]
		);
		if (row && row.fingerprint !== hash) sourceConflict();
		return !!row;
	}

	private record(manager: EntityManager, draftId: string, key: string, hash: string) {
		return manager.query(
			"INSERT INTO survival_document_edit_requests(draft_id,request_id,fingerprint) VALUES($1,$2,$3)",
			[draftId, key, hash]
		);
	}

	private async update(
		actor: string,
		documentId: string,
		draftId: string,
		dto: EditorRevisionDto,
		hash: string,
		snapshot: EditorSnapshot,
		confirm: boolean,
		action: string
	) {
		return this.repo.db.transaction(async (manager) => {
			const document = await this.repo.document(manager, documentId, true);
			const current = await this.read(manager, actor, documentId, draftId);
			if (await this.replayed(manager, draftId, dto.requestId, hash)) return current;
			if (
				current.revision !== dto.expectedRevision ||
				current.materializedVersionId ||
				document.revision !== current.baseRevision ||
				document.currentPublishedVersionId !== current.baseVersionId
			)
				sourceConflict();
			await manager.query(
				`UPDATE survival_document_edit_drafts SET revision=revision+1,snapshot=$2::jsonb,
				confirmed_revision=CASE WHEN $3 THEN revision+1 ELSE NULL END WHERE id=$1`,
				[draftId, this.serialize(snapshot), confirm]
			);
			await this.record(manager, draftId, dto.requestId, hash);
			await manager.query(
				`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"after",reason)
				VALUES($1,$2,'survival_document',$3,$4::jsonb,$5)`,
				[
					actor,
					`survival_document.${action}`,
					documentId,
					JSON.stringify({
						draftId,
						baseVersionId: current.baseVersionId,
						revision: current.revision + 1,
						changes: snapshot.changes,
					}),
					snapshot.reviewBasis ?? null,
				]
			);
			return this.read(manager, actor, documentId, draftId);
		});
	}

	private async interpret(
		documentId: string,
		sections: EditorSection[],
		input: string,
		history: Map<string, EditorSection[]>
	) {
		const operations: EditOperation[] = [];
		let proposed = sections;
		const propose = (op: EditOperation) => {
			proposed = applyEditorOperations(proposed, [op], history);
			operations.push(op);
		};
		for (const part of input
			.split(/[,;\n]+/)
			.map((line) => line.trim().replace(/[.!]$/, ""))
			.filter(Boolean)) {
			const move = /^chuyển\s+(?:mục\s+)?(.+?)\s+(?:đến|tới)\s+vị trí\s+(\d+)$/iu.exec(part);
			if (move) {
				propose({
					action: EditAction.REORDER,
					targetId: oneSection(proposed, move[1]).id,
					position: Number(move[2]) - 1,
				});
				continue;
			}
			const textEdit = /^(thêm|sửa)\s+mục\s+(.+?)\s*:\s*(.+)$/iu.exec(part);
			if (textEdit) {
				const inserting = /^thêm$/iu.test(textEdit[1]);
				propose({
					action: inserting ? EditAction.INSERT : EditAction.REPLACE,
					targetId: inserting ? undefined : oneSection(proposed, textEdit[2]).id,
					heading: textEdit[2],
					text: textEdit[3],
				});
				continue;
			}
			const local = /^(giữ nguyên|loại bỏ|xóa)\s+(?:(?:mục|phần)\s+)?(.+)$/iu.exec(part);
			if (local) {
				if (
					/^(các|những)\s+(mục|nội dung)\s+còn lại$/iu.test(local[2]) &&
					/^giữ nguyên$/iu.test(local[1])
				)
					continue;
				const named = /^(.+?)\s+của phiên bản\s+(\d+)$/iu.exec(local[2]);
				const target = oneSection(
					named
						? proposed.filter((section) => section.source?.versionNumber === Number(named[2]))
						: proposed,
					named?.[1] ?? local[2]
				);
				const op = {
					action: /^giữ nguyên$/iu.test(local[1]) ? EditAction.KEEP : EditAction.REMOVE,
					targetId: target.id,
				};
				propose(op);
				continue;
			}
			const replace =
				/^thay (?:thế\s+)?(?:mục\s+)?(.+?)\s+bằng\s+(?:mục\s+)?(.+?)\s+từ\s+(?:phiên bản\s*|v)(\d+)$/iu.exec(
					part
				);
			const restore =
				/^khôi phục\s+(?:(?:mục|phần)\s+)?(.+?)\s+(?:đã có trong|từ|ở)\s+(?:phiên bản\s*|v)(\d+)$/iu.exec(
					part
				);
			if (!restore && !replace)
				throw invalidSource(
					"Yêu cầu chưa xác định được mục hoặc thao tác. Hãy ghi tên mục và số phiên bản, hoặc chọn thao tác trong danh sách."
				);
			const [version]: SourceVersion[] = await this.repo.db.query(
				`${VERSION_SELECT} WHERE document_id=$1 AND version_number=$2`,
				[documentId, Number(replace?.[3] ?? restore?.[2])]
			);
			if (!version) throw invalidSource("Không tìm thấy phiên bản lịch sử được yêu cầu.");
			if (!history.has(version.id)) history.set(version.id, await this.extract(version));
			const previous = history.get(version.id) ?? [];
			const section = oneSection(previous, replace?.[2] ?? restore?.[1] ?? "");
			if (replace) {
				propose({
					action: EditAction.REPLACE,
					targetId: oneSection(proposed, replace[1]).id,
					fromVersionId: version.id,
					fromSectionId: section.id,
				});
				continue;
			}
			const offset = previous.indexOf(section);
			const locate = (item: EditorSection) => {
				const matches = proposed.filter(
					(candidate) =>
						candidate.heading.trim().toLocaleLowerCase("vi") ===
						item.heading.trim().toLocaleLowerCase("vi")
				);
				return matches.length === 1 ? proposed.indexOf(matches[0]) : -1;
			};
			const before = previous
				.slice(0, offset)
				.reverse()
				.map(locate)
				.find((index) => index >= 0);
			const after = previous
				.slice(offset + 1)
				.map(locate)
				.find((index) => index >= 0);
			if (
				(after === undefined && before === undefined) ||
				(after !== undefined && before !== undefined && before >= after)
			)
				throw invalidSource(
					"Chưa xác định được vị trí của mục khôi phục. Hãy chọn vị trí trong bản nháp."
				);
			const op = {
				action: EditAction.RESTORE,
				fromVersionId: version.id,
				fromSectionId: section.id,
				position: after ?? (before ?? 0) + 1,
			};
			propose(op);
		}
		if (!operations.length || operations.length > 40)
			throw invalidSource("Hãy nhập từ 1 đến 40 thay đổi.");
		return { operations, sections: proposed };
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

	private serialize(snapshot: EditorSnapshot) {
		const json = JSON.stringify(snapshot);
		if (Buffer.byteLength(json, "utf8") > MAX_EDITOR_BYTES)
			throw invalidSource("Bản nháp vượt giới hạn nội dung có thể biên tập.");
		return json;
	}

	private async post(path: "extract" | "compose", body: object): Promise<Response> {
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
				path === "extract"
					? "Không thể đọc cấu trúc PDF đủ tin cậy. Hãy dùng tệp PDF hoặc URL mới."
					: "Không thể tạo PDF bảo toàn nội dung đã xác nhận."
			);
		if (!response.ok) throw unavailable();
		return response;
	}
}
