import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { type Dispatcher, request as sendRequest } from "undici";
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
	type PreparedChunkOutput,
	chunkConfiguration,
} from "./knowledge-chunks.types";

const PASSAGE_BATCH_SIZE = 128;

@Injectable()
export class KnowledgeChunksProvider {
	private readonly logger = new Logger(KnowledgeChunksProvider.name);
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
			return (
				response.status === 204 &&
				response.headers.get("X-CTMS-Pipeline-Version") === this.configuration().pipeline_version
			);
		} catch {
			return false;
		}
	}
	async generate(
		set: ChunkSet,
		bytes: Buffer,
		title: string,
		signal: AbortSignal,
		findEmbeddings?: (inputs: string[]) => Promise<Map<string, number[]>>,
		checkpoint?: (output: PreparedChunkOutput) => Promise<void>
	): Promise<ChunkOutput> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) throw new IngestionError("ingestion_not_configured", true);
		const configured = Number(
			this.config.get<string>("KNOWLEDGE_EXTRACTION_TIMEOUT_MS") ?? 1800000
		);
		const timeout =
			Number.isSafeInteger(configured) && configured >= 60000 && configured <= 3600000
				? configured
				: 1800000;
		const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
		const post = (path: string, body: object) =>
			sendRequest(`${this.baseUrl}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
				body: JSON.stringify(body),
				signal: requestSignal,
				// Native fetch imposes a separate five-minute headers deadline even
				// when AbortSignal allows a longer extraction of a large PDF.
				headersTimeout: timeout,
				bodyTimeout: timeout,
			});
		const request = {
			extraction_snapshot: set.extraction_snapshot ?? null,
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
			if (!findEmbeddings || !preparedResponse || preparedResponse.statusCode === 404) {
				await preparedResponse?.body.dump();
				return validateChunkOutput(
					await this.readResult(await post("/knowledge-chunks", request)),
					set
				);
			}
			const output = validatePreparedChunkOutput(await this.readResult(preparedResponse), set);
			await checkpoint?.(output);
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
			if (requestSignal.aborted)
				throw new IngestionError(
					requestSignal.reason?.name === "TimeoutError"
						? "ingestion_timeout"
						: "ingestion_cancelled",
					true
				);
			const transport = error as { code?: unknown; cause?: { code?: unknown } } | null;
			const cause = transport?.code ?? transport?.cause?.code;
			if (["UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(String(cause)))
				throw new IngestionError("ingestion_timeout", true);
			const known = [
				"ECONNREFUSED",
				"ENOTFOUND",
				"EACCES",
				"ECONNRESET",
				"UND_ERR_CONNECT_TIMEOUT",
				"UND_ERR_SOCKET",
			];
			this.logger.warn(
				`Knowledge transport failure set=${set.id} cause=${typeof cause === "string" && known.includes(cause) ? cause : "unavailable"}`
			);
			throw new IngestionError("ingestion_transport", true);
		}
	}

	private async readResult(response: Dispatcher.ResponseData): Promise<unknown> {
		const status = response.statusCode;
		if (status >= 200 && status < 300) return response.body.json();
		// Consume error bodies as well, releasing the pooled connection for retries.
		const raw = await response.body.json().catch(() => null);
		const detail = (raw as { detail?: { code?: unknown; issue?: unknown } } | null)?.detail;
		if (status === 503) {
			if (detail?.code === "ocr_runtime_unavailable")
				throw new IngestionError("ocr_runtime_unavailable", true);
		}
		if (status === 422) {
			if (
				Array.isArray(detail) &&
				detail.some(
					(error) =>
						error?.type === "literal_error" &&
						Array.isArray(error.loc) &&
						error.loc[0] === "body" &&
						error.loc[1] === "configuration"
				)
			)
				throw new IngestionError("ingestion_configuration_mismatch", true);
			const issue = PDF_READ_ISSUES.find((code) => code === detail?.issue);
			if (detail?.code === "invalid_pdf" && issue) {
				throw new IngestionError("extraction_needs_review", false, {
					status: "NEEDS_REVIEW",
					issues: [issue],
					page_count: null,
				});
			}
		}
		throw new IngestionError(
			`ingestion_http_${status}`,
			[401, 429].includes(status) || status >= 500
		);
	}
}
