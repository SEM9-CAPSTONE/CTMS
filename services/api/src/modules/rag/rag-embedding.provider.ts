import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import {
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_REVISION,
} from "../knowledge-chunks/knowledge-chunks.types";
import { CONTEXT_TOKENIZER } from "./rag.types";

const MAX_RESPONSE_BYTES = 16384;
const NORM_TOLERANCE = 0.001;

function unavailable() {
	return new ServiceUnavailableException({ code: "RAG_EMBEDDING_UNAVAILABLE" });
}

@Injectable()
export class RagEmbeddingProvider {
	constructor(private readonly config: ConfigService) {}

	async embed(question: string, timeoutMs: number): Promise<number[]> {
		const result = await this.request("query-embedding", { question }, timeoutMs);
		const vector = result.embedding;
		if (
			result.dimensions !== EMBEDDING_DIMENSIONS ||
			!Array.isArray(vector) ||
			vector.length !== EMBEDDING_DIMENSIONS ||
			!vector.every((value) => typeof value === "number" && Number.isFinite(value)) ||
			Math.abs(Math.hypot(...vector) - 1) > NORM_TOLERANCE
		) {
			throw unavailable();
		}
		return vector;
	}

	async countPrefixes(blocks: string[], timeoutMs: number): Promise<number[]> {
		const result = await this.request("context-token-counts", { blocks }, timeoutMs);
		const counts = result.counts;
		if (
			result.tokenizer !== CONTEXT_TOKENIZER ||
			!Array.isArray(counts) ||
			counts.length !== blocks.length ||
			!counts.every((count) => Number.isSafeInteger(count) && count > 0)
		) {
			throw unavailable();
		}
		return counts;
	}

	private async request(
		path: "query-embedding" | "context-token-counts",
		payload: object,
		timeoutMs: number
	): Promise<Record<string, unknown>> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) throw unavailable();
		try {
			const base = this.config.get<string>("KNOWLEDGE_SERVICE_URL") ?? "http://localhost:8001";
			const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(timeoutMs),
				redirect: "error",
			});
			if (!response.ok) {
				await response.body?.cancel();
				if (response.status === 422 && path === "query-embedding") {
					throw new BadRequestException({ code: "RAG_INVALID_QUERY" });
				}
				throw unavailable();
			}
			const reader = response.body?.getReader();
			if (!reader) throw unavailable();
			const parts: Uint8Array[] = [];
			let size = 0;
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > MAX_RESPONSE_BYTES) {
					await reader.cancel();
					throw unavailable();
				}
				parts.push(value);
			}
			const value: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
			if (!value || typeof value !== "object") throw unavailable();
			const result = value as Record<string, unknown>;
			if (result.model !== EMBEDDING_MODEL || result.revision !== EMBEDDING_REVISION) {
				throw unavailable();
			}
			return result;
		} catch (error) {
			if (error instanceof BadRequestException) throw error;
			throw unavailable();
		}
	}
}
