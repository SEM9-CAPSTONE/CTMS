import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import type { ChunkSetSummary } from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksService {
	constructor(
		private readonly repository: KnowledgeChunksRepository,
		private readonly provider: KnowledgeChunksProvider
	) {}
	status(documentId: string, versionId: string): Promise<ChunkSetSummary[]> {
		return this.repository.status(documentId, versionId);
	}
	async enqueue(documentId: string, versionId: string): Promise<ChunkSetSummary> {
		const set = await this.repository.enqueue(documentId, versionId, this.provider.configuration());
		const summaries = await this.repository.status(documentId, versionId);
		const result = summaries.find((summary) => summary.id === set.id);
		if (!result) throw new Error("Enqueued chunk set is unavailable");
		return result;
	}
}
