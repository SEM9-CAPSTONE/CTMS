import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import {
	isValidEmbedding,
	validateChunkOutput,
	validatePreparedChunkOutput,
} from "./knowledge-chunks.policy";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	IngestionError,
	PDF_READ_ISSUES,
	chunkConfiguration,
} from "./knowledge-chunks.types";

const PASSAGE_BATCH_SIZE = 128;

@Injectable()
export class KnowledgeChunksProvider {
	constructor(private readonly config: ConfigService) {}
	private get baseUrl(): string {
		return this.config.get<string>("KNOWLEDGE_SERVICE_URL") || "http://localhost:8001";
	}
	configuration(): ChunkConfiguration {
		return chunkConfiguration();
	}
	async isAvailable(): Promise<boolean> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) return false;
		try {
			const response = await fetch(`${this.baseUrl}/readiness`, {
				headers: { "X-CTMS-Knowledge-Token": token },
				signal: AbortSignal.timeout(3000),
			});
			return response.status === 204;
		} catch {
			return false;
		}
	}
	async generate(
		set: ChunkSet,
		bytes: Buffer,
		title: string,
		signal: AbortSignal,
		findEmbeddings?: (inputs: string[]) => Promise<Map<string, number[]>>
	): Promise<ChunkOutput> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) throw new IngestionError("ingestion_not_configured", true);
		const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(600000)]);
		const post = (path: string, body: object) =>
			fetch(`${this.baseUrl}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
				body: JSON.stringify(body),
				signal: requestSignal,
			});
		const request = {
			document_version_id: set.document_version_id,
			source_version: set.source_version,
			checksum: set.checksum,
			locale: set.locale,
			title,
			configuration: set.configuration,
			pdf_base64: bytes.toString("base64"),
		};
		try {
			const preparedResponse = findEmbeddings
				? await post("/knowledge-chunks/prepare", request)
				: null;
			if (!findEmbeddings || !preparedResponse || preparedResponse.status === 404) {
				return validateChunkOutput(
					await this.readResult(await post("/knowledge-chunks", request)),
					set
				);
			}
			const output = validatePreparedChunkOutput(await this.readResult(preparedResponse), set);
			if (output.quality.status === "NEEDS_REVIEW") return { ...output, chunks: [] };
			requestSignal.throwIfAborted();
			const inputs = [...new Set(output.chunks.map((chunk) => chunk.embedding_text))];
			const vectors = await findEmbeddings(inputs);
			const dimensions = set.configuration.embedding_dimensions;
			const misses = inputs.filter((input) => !isValidEmbedding(vectors.get(input), dimensions));
			for (let offset = 0; offset < misses.length; offset += PASSAGE_BATCH_SIZE) {
				const passages = misses.slice(offset, offset + PASSAGE_BATCH_SIZE);
				const raw = await this.readResult(
					await post("/passage-embeddings", {
						configuration: set.configuration,
						passages,
					})
				);
				const embeddings = (raw as { embeddings?: unknown } | null)?.embeddings;
				if (
					!Array.isArray(embeddings) ||
					embeddings.length !== passages.length ||
					!embeddings.every((embedding) => isValidEmbedding(embedding, dimensions))
				) {
					throw new IngestionError("invalid_embedding_output", true);
				}
				passages.forEach((input, index) => vectors.set(input, embeddings[index]));
			}
			return validateChunkOutput(
				{
					...output,
					chunks: output.chunks.map((chunk) => ({
						...chunk,
						embedding: vectors.get(chunk.embedding_text),
					})),
				},
				set
			);
		} catch (error) {
			if (error instanceof IngestionError) throw error;
			throw new IngestionError("ingestion_transport", true);
		}
	}

	private async readResult(response: Response): Promise<unknown> {
		if (response.status === 422) {
			const raw: unknown = await response.json().catch(() => null);
			const detail = (raw as { detail?: { code?: unknown; issue?: unknown } } | null)?.detail;
			const issue = PDF_READ_ISSUES.find((code) => code === detail?.issue);
			if (detail?.code === "invalid_pdf" && issue) {
				throw new IngestionError("extraction_needs_review", false, {
					status: "NEEDS_REVIEW",
					issues: [issue],
					page_count: null,
				});
			}
		}
		if (!response.ok) {
			throw new IngestionError(
				`ingestion_http_${response.status}`,
				[401, 429].includes(response.status) || response.status >= 500
			);
		}
		return response.json();
	}
}
