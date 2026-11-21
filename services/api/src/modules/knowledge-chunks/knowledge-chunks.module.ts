import { Module } from "@nestjs/common";
import { RagModule } from "../rag/rag.module";
import { SurvivalDocumentsModule } from "../survival-documents/survival-documents.module";
import { ContentVerificationController } from "./content-verification.controller";
import { ContentVerificationService } from "./content-verification.service";
import { KnowledgeChunksController } from "./knowledge-chunks.controller";
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import { KnowledgeChunksService } from "./knowledge-chunks.service";
import { KnowledgeChunksWorker } from "./knowledge-chunks.worker";

@Module({
	imports: [SurvivalDocumentsModule, RagModule],
	controllers: [KnowledgeChunksController, ContentVerificationController],
	providers: [
		KnowledgeChunksRepository,
		KnowledgeChunksProvider,
		KnowledgeChunksWorker,
		KnowledgeChunksService,
		ContentVerificationService,
	],
	exports: [KnowledgeChunksRepository],
})
export class KnowledgeChunksModule {}
