import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import type { ChunkSetSummary } from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksService {
	constructor(private readonly repository: KnowledgeChunksRepository) {}
	status(documentId: string, versionId: string): Promise<ChunkSetSummary[]> {
		return this.repository.status(documentId, versionId);
	}
}
