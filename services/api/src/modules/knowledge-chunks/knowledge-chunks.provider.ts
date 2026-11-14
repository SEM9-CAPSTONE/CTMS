import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { validateChunkOutput } from "./knowledge-chunks.policy";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	chunkConfiguration,
	IngestionError,
} from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksProvider {
	constructor(private readonly config: ConfigService) {}
	configuration(): ChunkConfiguration {
		return chunkConfiguration();
	}
	async generate(
		set: ChunkSet,
		bytes: Buffer,
		title: string,
		signal: AbortSignal
	): Promise<ChunkOutput> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) throw new IngestionError("ingestion_not_configured");
		try {
			const response = await fetch(
				`${this.config.get<string>("KNOWLEDGE_SERVICE_URL") ?? "http://localhost:8001"}/knowledge-chunks`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
					body: JSON.stringify({
						document_version_id: set.document_version_id,
						source_version: set.source_version,
						checksum: set.checksum,
						locale: set.locale,
						title,
						configuration: set.configuration,
						pdf_base64: bytes.toString("base64"),
					}),
					signal: AbortSignal.any([signal, AbortSignal.timeout(600000)]),
				}
			);
			if (!response.ok)
				throw new IngestionError(
					`ingestion_http_${response.status}`,
					response.status === 429 || response.status >= 500
				);
			const raw: unknown = await response.json();
			return validateChunkOutput(raw, set);
		} catch (error) {
			if (error instanceof IngestionError) throw error;
			throw new IngestionError("ingestion_transport", true);
		}
	}
}
