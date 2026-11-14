import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { type EntityManager, QueryFailedError } from "typeorm";
import {
	type EditSourceDto,
	type ImportSourceDto,
	type ListSourcesDto,
	type PublishSourceDto,
	type RevisionDto,
	type UploadSourceDto,
	invalidSource,
	parseMetadata,
} from "./dto/source.dto";
import { sourceMaxBytes } from "./pdf-file-validator";
// biome-ignore lint/style/useImportType: Nest injection
import { type PdfSource, PdfSourceService } from "./pdf-source.service";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
import {
	assertApprovedSource,
	assertRights,
	isEligiblePublishedSource,
	isEligibleSourceContent,
	sourceContentIssue,
	validatePublicationMetadata,
	validatePublishedSourceMetadata,
	validateSourceMetadata,
} from "./source-policy";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceUploadCleanupService } from "./source-upload-cleanup.service";
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

type VersionChange =
	| { action: "metadata"; dto: EditSourceDto }
	| { action: "publish"; dto: PublishSourceDto }
	| { action: "archive"; dto: RevisionDto };

@Injectable()
export class SurvivalDocumentsService {
	private readonly logger = new Logger(SurvivalDocumentsService.name);
	constructor(
		private readonly repo: SurvivalDocumentsRepository,
		private readonly files: SourceFilesService,
		private readonly pdf: PdfSourceService,
		private readonly uploadCleanup: SourceUploadCleanupService
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
				const published = document.currentPublishedVersionId
					? await this.repo.version(manager, id, document.currentPublishedVersionId)
					: undefined;
				items.push({
					...document,
					publishedVersionNumber: published?.versionNumber ?? null,
					latestVersion: publicVersion(versions[0]),
					processingSyncStatus: isEligiblePublishedSource(
						published,
						document.currentPublishedVersionId
					)
						? "REGENERATION_NEEDED"
						: "NOT_PROCESSED",
				});
			}
			return {
				items,
				total: count[0].total,
				page: query.page,
				limit: query.limit,
				maxBytes: sourceMaxBytes(),
			};
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
			const published = versions.find(
				(version) => version.id === document.currentPublishedVersionId
			);
			return {
				...document,
				versions: versions.map(publicVersion),
				history,
				processingSyncStatus: isEligiblePublishedSource(
					published,
					document.currentPublishedVersionId
				)
					? ("REGENERATION_NEEDED" as const)
					: ("NOT_PROCESSED" as const),
				processingBlockedReason: published ? sourceContentIssue(published) : null,
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
			![DocumentStatus.PUBLISHED, DocumentStatus.SUPERSEDED].includes(originals[0].status) ||
			originals[0].metadata.locale !== (metadata.originalLocale ?? metadata.locale)
		)
			throw invalidSource("Phiên bản gốc chưa từng xuất bản hoặc không đúng ngôn ngữ gốc.");
	}
	async upload(actorId: string, dto: UploadSourceDto, file?: Express.Multer.File, id?: string) {
		const metadata = parseMetadata(dto.metadata);
		validateSourceMetadata(metadata);
		this.requireDocumentRevision(id, dto.expectedDocumentRevision);
		const stored = await this.pdf.fromUpload(file);
		if (id) await this.repo.document(this.repo.db.manager, id);
		return this.storeDraft(actorId, metadata, stored, "upload", id, dto.expectedDocumentRevision);
	}
	async importUrl(actorId: string, dto: ImportSourceDto, id?: string) {
		if (dto.metadata.sourceUrl && dto.metadata.sourceUrl !== dto.sourceUrl)
			throw invalidSource("URL nguồn phải khớp với URL PDF được nhập.");
		const metadata = {
			...dto.metadata,
			sourceUrl: dto.sourceUrl,
			retrievedAt: new Date().toISOString(),
		};
		validateSourceMetadata(metadata);
		this.requireDocumentRevision(id, dto.expectedDocumentRevision);
		if (id) await this.repo.document(this.repo.db.manager, id);
		const { finalSourceUrl, ...stored } = await this.pdf.fromUrl(dto.sourceUrl);
		metadata.sourceUrl = finalSourceUrl ?? metadata.sourceUrl;
		validateSourceMetadata(metadata);
		return this.storeDraft(
			actorId,
			metadata,
			stored,
			"import_url",
			id,
			dto.expectedDocumentRevision
		);
	}
	private requireDocumentRevision(id?: string, expectedDocumentRevision?: number): void {
		if (id && !expectedDocumentRevision) throw invalidSource("Thiếu số đối chiếu tài liệu.");
	}
	private async storeDraft(
		actorId: string,
		metadata: SourceMetadata,
		stored: PdfSource,
		action: "upload" | "import_url",
		id?: string,
		expectedDocumentRevision?: number
	) {
		const { checksum, originalFilename } = stored;
		await this.repo.assertPdfIsNew(this.repo.db.manager, checksum, originalFilename, id);
		const fileRef = randomUUID();
		await this.repo.db.query("INSERT INTO survival_document_uploads(file_ref) VALUES($1)", [
			fileRef,
		]);
		const documentId = id ?? randomUUID();
		try {
			await this.repo.db.transaction("READ COMMITTED", async (manager) => {
				// Always lock checksum before filename, then check again with a fresh snapshot.
				await manager.query(
					"SELECT pg_advisory_xact_lock(hashtextextended('survival_pdf:' || $1, 0))",
					[checksum]
				);
				await manager.query(
					"SELECT pg_advisory_xact_lock(hashtext('survival_pdf_filename'), hashtext(lower(btrim(normalize($1)))))",
					[originalFilename]
				);
				await this.repo.assertPdfIsNew(manager, checksum, originalFilename, id);
				// Hold the reservation while writing to keep cleanup from racing file storage.
				const reservations: Array<{ file_ref: string }> = await manager.query(
					"SELECT file_ref FROM survival_document_uploads WHERE file_ref=$1 FOR UPDATE",
					[fileRef]
				);
				if (!reservations.length) throw new Error("File reservation expired");
				let versionNumber = 1;
				if (id) {
					const document = await this.repo.document(manager, documentId, true);
					if (document.revision !== expectedDocumentRevision) sourceConflict();
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
				await this.files.write(fileRef, stored.bytes);
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
					action,
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
	async remove(actorId: string, id: string, expectedRevision: number): Promise<void> {
		let released: string[];
		try {
			released = await this.repo.db.transaction(async (manager) => {
				const document = await this.repo.document(manager, id, true);
				if (document.revision !== expectedRevision) sourceConflict();
				const versions: SourceVersion[] = await manager.query(
					`${VERSION_SELECT} WHERE document_id=$1 ORDER BY version_number DESC`,
					[id]
				);
				const fileRefs = versions.map((version) => version.fileRef);
				await manager.query(
					"UPDATE survival_documents SET current_published_version_id=NULL WHERE id=$1",
					[id]
				);
				await manager.query(
					`UPDATE survival_document_uploads SET version_id=NULL,
					 created_at=now()-interval '25 hours' WHERE file_ref=ANY($1::uuid[])`,
					[fileRefs]
				);
				await manager.query("DELETE FROM survival_documents WHERE id=$1", [id]);
				await manager.query(
					`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"before")
					 VALUES($1,'survival_document.delete','survival_document',$2,$3::jsonb)`,
					[
						actorId,
						id,
						JSON.stringify({
							revision: document.revision,
							versionCount: document.versionCount,
							currentPublishedVersionId: document.currentPublishedVersionId,
						}),
					]
				);
				const latestPublished = versions.find((version) => version.publishedAt);
				if (latestPublished)
					await this.event(
						manager,
						id,
						latestPublished,
						document.currentPublishedVersionId,
						"document_deleted"
					);
				return fileRefs;
			});
		} catch (error) {
			if (
				error instanceof QueryFailedError &&
				"code" in error.driverError &&
				error.driverError.code === "23503"
			)
				throw new ConflictException({
					code: "SOURCE_DELETE_REFERENCED",
					message:
						"Tài liệu đang được tài liệu khác tham chiếu. Hãy xử lý tài liệu phụ thuộc trước.",
				});
			throw error;
		}
		if (released.length)
			await this.uploadCleanup
				.cleanup(released)
				.catch(() =>
					this.logger.error("Private files from deleted survival document are queued for cleanup.")
				);
	}
	async change(
		actorId: string,
		documentId: string,
		versionId: string,
		{ action, dto }: VersionChange
	) {
		await this.repo.db.transaction(async (manager) => {
			const document = await this.repo.document(manager, documentId, true);
			const before = await this.repo.version(manager, documentId, versionId);
			if (before.revision !== dto.expectedRevision) sourceConflict();
			let status = before.status;
			switch (action) {
				case "metadata": {
					if (status !== DocumentStatus.DRAFT) sourceConflict();
					const metadata = dto.metadata;
					validateSourceMetadata(metadata);
					await this.original(manager, metadata);
					await manager.query(
						`UPDATE survival_document_versions
						 SET metadata=$2::jsonb,original_version_id=$3,
						 rights=CASE WHEN metadata IS DISTINCT FROM $2::jsonb THEN $4::jsonb ELSE rights END,
						 reviewed_by=CASE WHEN metadata IS DISTINCT FROM $2::jsonb THEN NULL ELSE reviewed_by END,
						 reviewed_at=CASE WHEN metadata IS DISTINCT FROM $2::jsonb THEN NULL ELSE reviewed_at END
						 WHERE id=$1`,
						[
							versionId,
							JSON.stringify(metadata),
							metadata.originalVersionId ?? null,
							JSON.stringify(UNREVIEWED_RIGHTS),
						]
					);
					break;
				}
				case "publish": {
					if (status !== DocumentStatus.DRAFT) sourceConflict();
					const newer: Array<{ id: string }> = await manager.query(
						"SELECT id FROM survival_document_versions WHERE document_id=$1 AND version_number>$2 AND published_at IS NOT NULL",
						[documentId, before.versionNumber]
					);
					if (newer.length) sourceConflict();
					const rights = dto.rights ?? before.rights;
					if (dto.rights) {
						validatePublicationMetadata(before.metadata);
						assertRights(before.metadata, dto.rights);
					} else {
						validatePublishedSourceMetadata(before.metadata);
					}
					assertApprovedSource(before);
					await this.original(manager, before.metadata);
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
						`UPDATE survival_document_versions
						 SET published_by=$2,published_at=now(),rights=$3::jsonb,
						 reviewed_by=CASE WHEN $4 THEN $2 ELSE reviewed_by END,
						 reviewed_at=CASE WHEN $4 THEN now() ELSE reviewed_at END
						 WHERE id=$1`,
						[versionId, actorId, JSON.stringify(rights), !!dto.rights]
					);
					await manager.query(
						"UPDATE survival_documents SET current_published_version_id=$2 WHERE id=$1",
						[documentId, versionId]
					);
					await this.event(
						manager,
						documentId,
						{ ...before, rights },
						document.currentPublishedVersionId,
						"published_version_changed",
						isEligibleSourceContent({ ...before, rights })
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
				`UPDATE survival_document_versions SET status=$2::varchar,revision=revision+1,
				 reason=CASE WHEN $2::varchar='PUBLISHED' THEN $3::varchar ELSE COALESCE($3::varchar,reason) END WHERE id=$1`,
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
		type: "published_version_changed" | "source_unavailable" | "document_deleted",
		canProcess = false
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
					regenerationNeeded: type !== "published_version_changed" || canProcess,
					internalRagUseAllowed: version.rights.internalRagUseAllowed,
					offlineRedistributionAllowed: version.rights.offlineRedistributionAllowed,
				}),
			]
		);
	}
}
