import { Injectable, NotFoundException } from "@nestjs/common";
import { invalidSource } from "./dto/source.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
import { assertRights, isEligiblePublishedSource } from "./source-policy";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsRepository, sourceConflict } from "./survival-documents.repository";
import {
	DocumentStatus,
	type SourceUse,
	type SourceVersion,
	VERSION_SELECT,
} from "./survival-documents.types";

/** Trusted in-process CTMS-051 boundary. Consumers must revalidate before committing generated artifacts. */
@Injectable()
export class SurvivalSourceReader {
	constructor(
		private readonly repo: SurvivalDocumentsRepository,
		private readonly files: SourceFilesService
	) {}
	/** Historical citations may resolve withdrawn/superseded publications, without granting processing access. */
	async resolvePublishedProvenance(versionId: string) {
		const versions: SourceVersion[] = await this.repo.db.query(
			`${VERSION_SELECT} WHERE id=$1 AND published_at IS NOT NULL`,
			[versionId]
		);
		const version = versions[0];
		if (!version) throw new NotFoundException("Không tìm thấy phiên bản đã từng xuất bản.");
		return {
			documentId: version.documentId,
			versionId: version.id,
			sourceVersion: version.versionNumber,
			checksum: version.checksum,
			locale: version.metadata.locale,
			metadata: version.metadata,
			rights: version.rights,
			publicationStatus: version.status,
			reviewedBy: version.reviewedBy,
			reviewedAt: version.reviewedAt,
			publishedAt: version.publishedAt,
			historicalOnly: true as const,
		};
	}
	async readPublished(versionId: string, use: SourceUse = "AI") {
		return this.repo.db.transaction(async (manager) => {
			const identity: Array<{ documentId: string }> = await manager.query(
				'SELECT document_id AS "documentId" FROM survival_document_versions WHERE id=$1',
				[versionId]
			);
			if (!identity[0]) throw new NotFoundException("Không tìm thấy phiên bản nguồn.");
			// Same lock ordering as Admin publication/stop-use prevents mixed-version reads.
			const document = await this.repo.document(manager, identity[0].documentId, true);
			const version: SourceVersion = (
				await manager.query(`${VERSION_SELECT} WHERE id=$1`, [versionId])
			)[0];
			if (
				version.status !== DocumentStatus.PUBLISHED ||
				document.currentPublishedVersionId !== version.id
			)
				sourceConflict();
			if (!isEligiblePublishedSource(version, document.currentPublishedVersionId))
				throw invalidSource("Phiên bản hiện hành chưa đủ điều kiện xử lý tri thức.");
			// Offline Packages distribute approved guidance. This reader returns the original PDF.
			if (use !== "AI") {
				if (!version.reviewedBy || !version.reviewedAt)
					throw invalidSource("Chưa ghi nhận quyền sử dụng tệp PDF gốc.");
				assertRights(version.metadata, version.rights, use);
			}
			return {
				manifest: {
					documentId: document.id,
					versionId: version.id,
					sourceVersion: version.versionNumber,
					checksum: version.checksum,
					locale: version.metadata.locale,
					metadata: version.metadata,
					rights: version.rights,
					reviewedBy: version.reviewedBy,
					reviewedAt: version.reviewedAt,
					publishedAt: version.publishedAt,
					processingSyncStatus: "REGENERATION_NEEDED" as const,
				},
				bytes: await this.files.read(version),
			};
		});
	}
}
