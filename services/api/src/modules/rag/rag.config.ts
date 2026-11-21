import { createHash } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import {
	CROSS_LINGUAL_RELEVANCE_VERSION,
	MAX_CONTEXT_BLOCKS,
	MAX_QUERY_LENGTH,
	RAG_LOCALE_PATTERN,
} from "./rag.types";

@Injectable()
export class RagConfig {
	constructor(private readonly env: ConfigService) {}

	private locales(raw: string) {
		const locales = [...new Set(raw.split(",").map((locale) => locale.trim()))];
		if (locales.length > 20 || locales.some((locale) => !RAG_LOCALE_PATTERN.test(locale))) {
			throw new ServiceUnavailableException({ code: "RAG_CONFIGURATION_INVALID" });
		}
		return locales;
	}

	sourceLocales() {
		return this.locales(
			this.env.get<string>("RAG_SOURCE_LOCALES")?.trim() ||
				(this.env.get<string>("RAG_LOCALES") ?? "vi,vi-VN,en")
		);
	}

	settings() {
		const number = (name: string, min: number, max: number, fallback?: number, decimal = false) => {
			const raw = this.env.get<string>(name);
			const value = raw === undefined ? fallback : raw.trim() ? Number(raw) : undefined;
			if (
				value === undefined ||
				!Number.isFinite(value) ||
				value < min ||
				value > max ||
				(!decimal && !Number.isInteger(value))
			) {
				throw new ServiceUnavailableException({ code: "RAG_CONFIGURATION_INVALID" });
			}
			return value;
		};
		const settings = {
			locales: this.locales(this.env.get<string>("RAG_LOCALES") ?? "vi,vi-VN,en"),
			sourceLocales: this.sourceLocales(),
			topK: number("RAG_TOP_K", 1, MAX_CONTEXT_BLOCKS, 5),
			maxSources: number("RAG_MAX_SOURCES", 1, MAX_CONTEXT_BLOCKS, 3),
			maxCandidates: number("RAG_MAX_CANDIDATES", 1, 10000, 5000),
			contextTokenBudget: number("RAG_CONTEXT_TOKEN_BUDGET", 1, 4096, 1200),
			minScore: number("RAG_MIN_SCORE", 0.01, 1, undefined, true),
			crossLingualMinScore: number("RAG_CROSS_LINGUAL_MIN_SCORE", 0.01, 1, 0.74, true),
			crossLingualRelevance: CROSS_LINGUAL_RELEVANCE_VERSION,
			maxQueryLength: number("RAG_MAX_QUERY_LENGTH", 1, MAX_QUERY_LENGTH, MAX_QUERY_LENGTH),
			providerTimeoutMs: number("RAG_PROVIDER_TIMEOUT_MS", 100, 30000, 2500),
			databaseTimeoutMs: number("RAG_DATABASE_TIMEOUT_MS", 100, 10000, 2000),
		};
		const hash = createHash("sha256").update(JSON.stringify(settings)).digest("hex");
		return { ...settings, version: `ctms-068-v2:${hash}` };
	}
}

export type RagSettings = ReturnType<RagConfig["settings"]>;
