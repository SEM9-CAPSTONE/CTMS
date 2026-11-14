import { Module } from "@nestjs/common";
import { RagEmbeddingProvider } from "./rag-embedding.provider";
import { RagRetrievalService } from "./rag-retrieval.service";
import { RagConfig } from "./rag.config";
import { RagRepository } from "./rag.repository";

@Module({
	providers: [RagConfig, RagEmbeddingProvider, RagRepository, RagRetrievalService],
	exports: [RagRetrievalService, RagRepository],
})
export class RagModule {}
