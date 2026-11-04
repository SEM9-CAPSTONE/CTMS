import { randomUUID } from "node:crypto";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
	type EditSourceDto,
	type ListSourcesDto,
	type ReviewSourceDto,
	type RevisionDto,
	type UploadSourceDto,
	invalidSource,
	parseMetadata,
} from "./dto/source.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
import { assertRights, validateSourceMetadata } from "./source-policy";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsRepository, sourceConflict } from "./survival-documents.repository";
import {
	type DocumentListItem,
	DocumentStatus,
	type SourceMetadata,
	type SourceVersion,
	UNREVIEWED_RIGHTS,
	VERSION_SELECT,
	publicVersion,
} from "./survival-documents.types";

@Injectable()
export class SurvivalDocumentsService {
	private readonly logger = new Logger(SurvivalDocumentsService.name);
	constructor(
		private readonly repo: SurvivalDocumentsRepository,
		private readonly files: SourceFilesService
	) {}
	async list(query: ListSourcesDto) {
		return this.repo.db.transaction("REPEATABLE READ", async (manager) => {
			const where = `FROM survival_documents d JOIN survival_document_versions v ON v.document_id=d.id AND v.version_number=d.version_count
			 WHERE ($1::text IS NULL OR v.metadata->>'sourceTitle' ILIKE '%'||$1||'%' OR v.metadata->>'publisher' ILIKE '%'||$1||'%')
			 AND ($2::text IS NULL OR v.metadata->>'classification'=$2) AND ($3::text IS NULL OR v.metadata->>'locale'=$3) AND ($4::text IS NULL OR v.status=$4)`;
			const filters = [
				query.search ?? null,
				query.classification ?? null,
				query.locale ?? null,
				query.status ?? null,
			];
			const count: Array<{ total: number }> = await manager.query(
				`SELECT count(*)::int AS total ${where}`,
				filters
			);
			const ids: Array<{ id: string }> = await manager.query(
				`SELECT d.id ${where} ORDER BY d.updated_at DESC,d.id LIMIT $5 OFFSET $6`,
				[...filters, query.limit, (query.page - 1) * query.limit]
			);
			const items: DocumentListItem[] = [];
			for (const { id } of ids) {
				const document = await this.repo.document(manager, id);
				const versions: SourceVersion[] = await manager.query(
					`${VERSION_SELECT} WHERE document_id=$1 AND version_number=$2`,
					[id, document.versionCount]
				);
				items.push({
					...document,
					publishedVersionNumber: document.currentPublishedVersionId
						? (await this.repo.version(manager, id, document.currentPublishedVersionId))
								.versionNumber
						: null,
					latestVersion: publicVersion(versions[0]),
					processingSyncStatus: document.currentPublishedVersionId
						? "REGENERATION_NEEDED"
						: "NOT_PROCESSED",
				});
			}
			return { items, total: count[0].total, page: query.page, limit: query.limit };
		});
	}
	async detail(id: string) {
		return this.repo.db.transaction("REPEATABLE READ", async (manager) => {
			const document = await this.repo.document(manager, id);
			const versions: SourceVersion[] = await manager.query(
				`${VERSION_SELECT} WHERE document_id=$1 ORDER BY version_number DESC`,
				[id]
			);
			const history: Array<{
				id: string;
				actorId: string;
				action: string;
				before: unknown;
				after: unknown;
				reason: string | null;
				createdAt: string;
			}> = await manager.query(
				`SELECT id,actor_id AS "actorId",action,"before","after",reason,created_at AS "createdAt" FROM audit_logs WHERE target_type='survival_document' AND target_id=$1 ORDER BY created_at DESC,id`,
				[id]
			);
			return {
				...document,
				versions: versions.map(publicVersion),
				history,
				processingSyncStatus: document.currentPublishedVersionId
					? ("REGENERATION_NEEDED" as const)
					: ("NOT_PROCESSED" as const),
			};
		});
	}
	private async original(manager: EntityManager, metadata: SourceMetadata): Promise<void> {
		if (!metadata.originalVersionId) return;
		const originals: SourceVersion[] = await manager.query(`${VERSION_SELECT} WHERE id=$1`, [
			metadata.originalVersionId,
		]);
		if (
			!originals[0] ||
			![DocumentStatus.APPROVED, DocumentStatus.PUBLISHED, DocumentStatus.SUPERSEDED].includes(
				originals[0].status
			) ||
			originals[0].metadata.locale !== metadata.originalLocale
		)
			throw invalidSource("Phiên bản gốc chưa được duyệt hoặc không đúng ngôn ngữ gốc.");
	}
	async upload(actorId: string, dto: UploadSourceDto, file?: Express.Multer.File, id?: string) {
		const metadata = parseMetadata(dto.metadata);
		validateSourceMetadata(metadata);
		if (id && !dto.expectedDocumentRevision) throw invalidSource("Thiếu số đối chiếu tài liệu.");
		const stored = this.files.validate(file);
		if (!file) throw invalidSource("Vui lòng chọn tệp PDF.");
		const fileRef = randomUUID();
		await this.repo.db.query("INSERT INTO survival_document_uploads(file_ref) VALUES($1)", [
			fileRef,
		]);
		const documentId = id ?? randomUUID();
		try {
			await this.files.write(fileRef, file.buffer);
			await this.repo.db.transaction(async (manager) => {
				// Lock the reservation so cleanup cannot remove a long-running upload at commit.
				await manager.query(
					"SELECT file_ref FROM survival_document_uploads WHERE file_ref=$1 FOR UPDATE",
					[fileRef]
				);
				let versionNumber = 1;
				if (id) {
					const document = await this.repo.document(manager, documentId, true);
					if (document.revision !== dto.expectedDocumentRevision) sourceConflict();
					versionNumber = document.versionCount + 1;
					await manager.query(
						"UPDATE survival_documents SET version_count=$2,revision=revision+1,updated_at=now() WHERE id=$1",
						[documentId, versionNumber]
					);
				} else {
					await manager.query("INSERT INTO survival_documents(id,created_by) VALUES($1,$2)", [
						documentId,
						actorId,
					]);
				}
				await this.original(manager, metadata);
				const versionId = randomUUID();
				await manager.query(
					`INSERT INTO survival_document_versions(id,document_id,version_number,metadata,rights,file_ref,original_filename,checksum,size,content_type,original_version_id,created_by)
				 VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,
					[
						versionId,
						documentId,
						versionNumber,
						JSON.stringify(metadata),
						JSON.stringify(UNREVIEWED_RIGHTS),
						fileRef,
						stored.originalFilename,
						stored.checksum,
						stored.size,
						stored.contentType,
						metadata.originalVersionId ?? null,
						actorId,
					]
				);
				await manager.query(
					"UPDATE survival_document_uploads SET version_id=$2 WHERE file_ref=$1",
					[fileRef, versionId]
				);
				await this.repo.audit(
					manager,
					actorId,
					"upload",
					documentId,
					await this.repo.version(manager, documentId, versionId),
					null
				);
			});
		} catch (error) {
			try {
				// Resolve commit uncertainty before deleting any potentially retained original.
				const rows: Array<{ versionId: string | null }> = await this.repo.db.query(
					'SELECT version_id AS "versionId" FROM survival_document_uploads WHERE file_ref=$1',
					[fileRef]
				);
				if (!rows[0]?.versionId) {
					await this.files.remove(fileRef);
					await this.repo.db.query(
						"DELETE FROM survival_document_uploads WHERE file_ref=$1 AND version_id IS NULL",
						[fileRef]
					);
				}
			} catch {
				this.logger.error(
					"Private upload compensation pending; durable reservation retained for cleanup."
				);
			}
			if (error instanceof Error && "getStatus" in error) throw error;
			throw new ServiceUnavailableException({
				code: "SOURCE_UPLOAD_FAILED",
				message: "Không thể lưu tài liệu. Vui lòng thử lại.",
			});
		}
		return this.detail(documentId);
	}
	async file(documentId: string, versionId: string) {
		const version = await this.repo.version(this.repo.db.manager, documentId, versionId);
		return { bytes: await this.files.read(version), filename: version.originalFilename };
	}
	async change(
		actorId: string,
		documentId: string,
		versionId: string,
		action: "metadata" | "submit" | "review" | "publish" | "archive",
		dto: RevisionDto | EditSourceDto | ReviewSourceDto
	) {
		await this.repo.db.transaction(async (manager) => {
			const document = await this.repo.document(manager, documentId, true);
			const before = await this.repo.version(manager, documentId, versionId);
			if (before.revision !== dto.expectedRevision) sourceConflict();
			let status = before.status;
			switch (action) {
				case "metadata": {
					if (status !== DocumentStatus.DRAFT) sourceConflict();
					const metadata = (dto as EditSourceDto).metadata;
					validateSourceMetadata(metadata);
					await this.original(manager, metadata);
					await manager.query(
						"UPDATE survival_document_versions SET metadata=$2::jsonb,original_version_id=$3 WHERE id=$1",
						[versionId, JSON.stringify(metadata), metadata.originalVersionId ?? null]
					);
					break;
				}
				case "submit":
					if (status !== DocumentStatus.DRAFT) sourceConflict();
					validateSourceMetadata(before.metadata);
					await this.files.read(before);
					status = DocumentStatus.IN_REVIEW;
					break;
				case "review": {
					if (status !== DocumentStatus.IN_REVIEW) sourceConflict();
					const review = dto as ReviewSourceDto;
					if (!review.rights) throw invalidSource("Thiếu quyết định quyền sử dụng.");
					if (review.decision === "reject") {
						if (!review.reason?.trim()) throw invalidSource("Vui lòng nhập lý do từ chối.");
						status = DocumentStatus.REJECTED;
					} else {
						assertRights(before.metadata, review.rights);
						await this.files.read(before);
						status = DocumentStatus.APPROVED;
					}
					await manager.query(
						"UPDATE survival_document_versions SET rights=$2::jsonb,reviewed_by=$3,reviewed_at=now() WHERE id=$1",
						[versionId, JSON.stringify(review.rights), actorId]
					);
					break;
				}
				case "publish": {
					if (status !== DocumentStatus.APPROVED) sourceConflict();
					const newer: Array<{ id: string }> = await manager.query(
						"SELECT id FROM survival_document_versions WHERE document_id=$1 AND version_number>$2 AND published_at IS NOT NULL",
						[documentId, before.versionNumber]
					);
					if (newer.length) sourceConflict();
					assertRights(before.metadata, before.rights);
					await this.files.read(before);
					if (document.currentPublishedVersionId) {
						const previous = await this.repo.version(
							manager,
							documentId,
							document.currentPublishedVersionId
						);
						if (previous.versionNumber >= before.versionNumber) sourceConflict();
						await manager.query(
							"UPDATE survival_document_versions SET status='SUPERSEDED',revision=revision+1 WHERE id=$1",
							[previous.id]
						);
						await this.repo.audit(
							manager,
							actorId,
							"supersede",
							documentId,
							{ ...previous, status: DocumentStatus.SUPERSEDED, revision: previous.revision + 1 },
							previous
						);
					}
					status = DocumentStatus.PUBLISHED;
					await manager.query(
						"UPDATE survival_document_versions SET published_by=$2,published_at=now() WHERE id=$1",
						[versionId, actorId]
					);
					await manager.query(
						"UPDATE survival_documents SET current_published_version_id=$2 WHERE id=$1",
						[documentId, versionId]
					);
					await this.event(
						manager,
						documentId,
						before,
						document.currentPublishedVersionId,
						"published_version_changed"
					);
					break;
				}
				case "archive":
					if (
						status !== DocumentStatus.PUBLISHED ||
						document.currentPublishedVersionId !== versionId
					)
						sourceConflict();
					if (!dto.reason?.trim()) throw invalidSource("Vui lòng nhập lý do ngừng sử dụng.");
					status = DocumentStatus.ARCHIVED;
					await manager.query(
						"UPDATE survival_documents SET current_published_version_id=NULL WHERE id=$1",
						[documentId]
					);
					await this.event(manager, documentId, before, versionId, "source_unavailable");
					break;
			}
			await manager.query(
				"UPDATE survival_document_versions SET status=$2,revision=revision+1,reason=COALESCE($3,reason) WHERE id=$1",
				[versionId, status, dto.reason ?? null]
			);
			await manager.query(
				"UPDATE survival_documents SET revision=revision+1,updated_at=now() WHERE id=$1",
				[documentId]
			);
			await this.repo.audit(
				manager,
				actorId,
				action,
				documentId,
				await this.repo.version(manager, documentId, versionId),
				before,
				dto.reason
			);
		});
		return this.detail(documentId);
	}
	private async event(
		manager: EntityManager,
		documentId: string,
		version: SourceVersion,
		previousId: string | null,
		type: string
	): Promise<void> {
		await manager.query(
			"INSERT INTO survival_document_outbox(document_id,version_id,previous_version_id,event_type,payload) VALUES($1,$2,$3,$4,$5::jsonb)",
			[
				documentId,
				version.id,
				previousId,
				type,
				JSON.stringify({
					documentId,
					versionId: version.id,
					previousVersionId: previousId,
					sourceVersion: version.versionNumber,
					checksum: version.checksum,
					locale: version.metadata.locale,
					regenerationNeeded: true,
					offlineRedistributionAllowed: version.rights.offlineRedistributionAllowed,
				}),
			]
		);
	}
}
