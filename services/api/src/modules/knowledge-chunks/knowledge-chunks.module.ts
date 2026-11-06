import { Module } from "@nestjs/common";
import { SurvivalDocumentsModule } from "../survival-documents/survival-documents.module";
import { KnowledgeChunksController } from "./knowledge-chunks.controller";
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import { KnowledgeChunksService } from "./knowledge-chunks.service";
import { KnowledgeChunksWorker } from "./knowledge-chunks.worker";

@Module({
	imports: [SurvivalDocumentsModule],
	controllers: [KnowledgeChunksController],
	providers: [
		KnowledgeChunksRepository,
		KnowledgeChunksProvider,
		KnowledgeChunksWorker,
		KnowledgeChunksService,
	],
	exports: [KnowledgeChunksRepository],
})
export class KnowledgeChunksModule {}
