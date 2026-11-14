import { createHash } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { MAX_CONTEXT_BLOCKS, MAX_QUERY_LENGTH } from "./rag.types";

const LOCALE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

@Injectable()
export class RagConfig {
	constructor(private readonly env: ConfigService) {}

	settings() {
		const number = (name: string, min: number, max: number, fallback?: number) => {
			const raw = this.env.get<string>(name);
			const value = raw === undefined ? fallback : raw.trim() ? Number(raw) : undefined;
			if (
				value === undefined ||
				!Number.isFinite(value) ||
				value < min ||
				value > max ||
				(name !== "RAG_MIN_SCORE" && !Number.isInteger(value))
			) {
				throw new ServiceUnavailableException({ code: "RAG_CONFIGURATION_INVALID" });
			}
			return value;
		};
		const locales = (this.env.get<string>("RAG_LOCALES") ?? "vi,vi-VN,en")
			.split(",")
			.map((locale) => locale.trim());
		if (locales.length > 20 || locales.some((locale) => !LOCALE.test(locale))) {
			throw new ServiceUnavailableException({ code: "RAG_CONFIGURATION_INVALID" });
		}
		const settings = {
			locales,
			topK: number("RAG_TOP_K", 1, MAX_CONTEXT_BLOCKS, 5),
			maxSources: number("RAG_MAX_SOURCES", 1, MAX_CONTEXT_BLOCKS, 3),
			maxCandidates: number("RAG_MAX_CANDIDATES", 1, 10000, 5000),
			contextTokenBudget: number("RAG_CONTEXT_TOKEN_BUDGET", 1, 4096, 1200),
			minScore: number("RAG_MIN_SCORE", 0.01, 1),
			maxQueryLength: number("RAG_MAX_QUERY_LENGTH", 1, MAX_QUERY_LENGTH, MAX_QUERY_LENGTH),
			providerTimeoutMs: number("RAG_PROVIDER_TIMEOUT_MS", 100, 30000, 2500),
			databaseTimeoutMs: number("RAG_DATABASE_TIMEOUT_MS", 100, 10000, 2000),
		};
		const hash = createHash("sha256").update(JSON.stringify(settings)).digest("hex");
		return { ...settings, version: `ctms-068-v1:${hash}` };
	}
}

export type RagSettings = ReturnType<RagConfig["settings"]>;
