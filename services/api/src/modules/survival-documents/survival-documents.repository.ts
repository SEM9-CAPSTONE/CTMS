import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection
import { DataSource, type EntityManager } from "typeorm";
import {
	DOCUMENT_SELECT,
	type SourceVersion,
	type SurvivalDocument,
	VERSION_SELECT,
} from "./survival-documents.types";

export function sourceConflict(): never {
	throw new ConflictException({
		code: "SOURCE_CONFLICT",
		message: "Tài liệu đã thay đổi hoặc trạng thái không cho phép thao tác này. Vui lòng tải lại.",
	});
}
@Injectable()
export class SurvivalDocumentsRepository {
	constructor(readonly db: DataSource) {}
	async document(manager: EntityManager, id: string, lock = false): Promise<SurvivalDocument> {
		const rows: SurvivalDocument[] = await manager.query(
			`${DOCUMENT_SELECT} WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
			[id]
		);
		if (!rows[0]) throw new NotFoundException("Không tìm thấy tài liệu.");
		return rows[0];
	}
	async version(manager: EntityManager, documentId: string, id: string): Promise<SourceVersion> {
		const rows: SourceVersion[] = await manager.query(
			`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
			[documentId, id]
		);
		if (!rows[0]) throw new NotFoundException("Không tìm thấy phiên bản tài liệu.");
		return rows[0];
	}
	async audit(
		manager: EntityManager,
		actorId: string,
		action: string,
		documentId: string,
		version: SourceVersion,
		before: SourceVersion | null,
		reason?: string
	): Promise<void> {
		await manager.query(
			`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"before","after",reason)
		 VALUES($1,$2,'survival_document',$3,$4::jsonb,$5::jsonb,$6)`,
			[
				actorId,
				`survival_document.${action}`,
				documentId,
				before
					? JSON.stringify({
							versionId: before.id,
							status: before.status,
							revision: before.revision,
						})
					: null,
				JSON.stringify({
					versionId: version.id,
					versionNumber: version.versionNumber,
					status: version.status,
					revision: version.revision,
					checksum: version.checksum,
					rightsReviewStatus: version.rights.rightsReviewStatus,
				}),
				reason?.slice(0, 255) ?? null,
			]
		);
	}
}
