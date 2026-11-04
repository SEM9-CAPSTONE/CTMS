import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { SourceFilesService } from "./source-files.service";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsRepository } from "./survival-documents.repository";

@Injectable()
export class SourceUploadCleanupService implements OnModuleInit, OnModuleDestroy {
	private timer?: ReturnType<typeof setInterval>;
	private readonly logger = new Logger(SourceUploadCleanupService.name);
	constructor(
		private readonly repo: SurvivalDocumentsRepository,
		private readonly files: SourceFilesService
	) {}
	onModuleInit(): void {
		if (process.env.NODE_ENV === "test") return;
		const run = () =>
			void this.cleanup().catch(() =>
				this.logger.error("Private source cleanup failed; retained reservations will be retried.")
			);
		run();
		this.timer = setInterval(run, 60 * 60 * 1000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}
	async cleanup(): Promise<void> {
		await this.repo.db.transaction(async (manager) => {
			const rows: Array<{ fileRef: string }> =
				await manager.query(`SELECT file_ref AS "fileRef" FROM survival_document_uploads
			 WHERE version_id IS NULL AND created_at < now()-interval '24 hours' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`);
			for (const row of rows) {
				await this.files.remove(row.fileRef);
				await manager.query(
					"DELETE FROM survival_document_uploads WHERE file_ref=$1 AND version_id IS NULL",
					[row.fileRef]
				);
			}
		});
	}
}
