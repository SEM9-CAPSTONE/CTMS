import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { KnowledgeChunksRepository } from "../knowledge-chunks/knowledge-chunks.repository";
import { DocumentEditorController } from "./document-editor.controller";
import { DocumentEditorService } from "./document-editor.service";
import { sourceMaxBytes } from "./pdf-file-validator";
import { PdfSourceService } from "./pdf-source.service";
import { SourceFilesService } from "./source-files.service";
import { SourceUploadCleanupService } from "./source-upload-cleanup.service";
import { SurvivalDocumentsController } from "./survival-documents.controller";
import { SurvivalDocumentsRepository } from "./survival-documents.repository";
import { SurvivalDocumentsService } from "./survival-documents.service";
import { SurvivalSourceReader } from "./survival-source-reader.service";

@Module({
	// Resolve limits after ConfigModule has loaded .env, rather than at import time.
	imports: [
		MulterModule.registerAsync({
			// Busboy emits its limit event at equality. The PDF validator enforces the inclusive cap.
			useFactory: () => ({ limits: { fileSize: sourceMaxBytes() + 1, files: 1, fields: 2 } }),
		}),
	],
	controllers: [SurvivalDocumentsController, DocumentEditorController],
	providers: [
		KnowledgeChunksRepository,
		SurvivalDocumentsRepository,
		SurvivalDocumentsService,
		DocumentEditorService,
		PdfSourceService,
		SourceFilesService,
		SourceUploadCleanupService,
		SurvivalSourceReader,
	],
	exports: [SurvivalSourceReader, KnowledgeChunksRepository],
})
export class SurvivalDocumentsModule {}
