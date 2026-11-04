import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { SourceFilesService, sourceMaxBytes } from "./source-files.service";
import { SourceUploadCleanupService } from "./source-upload-cleanup.service";
import { SurvivalDocumentsController } from "./survival-documents.controller";
import { SurvivalDocumentsRepository } from "./survival-documents.repository";
import { SurvivalDocumentsService } from "./survival-documents.service";
import { SurvivalSourceReader } from "./survival-source-reader.service";

@Module({
	// Resolve limits after ConfigModule has loaded .env, rather than at import time.
	imports: [
		MulterModule.registerAsync({
			useFactory: () => ({ limits: { fileSize: sourceMaxBytes(), files: 1, fields: 2 } }),
		}),
	],
	controllers: [SurvivalDocumentsController],
	providers: [
		SurvivalDocumentsRepository,
		SurvivalDocumentsService,
		SourceFilesService,
		SourceUploadCleanupService,
		SurvivalSourceReader,
	],
	exports: [SurvivalSourceReader],
})
export class SurvivalDocumentsModule {}
