import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { contextBlocks, selectRagChunks } from "./rag-context";
// biome-ignore lint/style/useImportType: Nest injection
import { RagEmbeddingProvider } from "./rag-embedding.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { RagConfig } from "./rag.config";
// biome-ignore lint/style/useImportType: Nest injection
import { RagRepository } from "./rag.repository";
import type { InsufficientReason, RagQuery, RagResult } from "./rag.types";

@Injectable()
export class RagRetrievalService {
	private readonly logger = new Logger(RagRetrievalService.name);

	constructor(
		private readonly config: RagConfig,
		private readonly embedding: RagEmbeddingProvider,
		private readonly repository: RagRepository
	) {}

	/** The consumer supplies the backend-authenticated actor independently from the query. */
	async retrieve(actor: AuthenticatedUser, query: RagQuery): Promise<RagResult> {
		if (
			!actor?.userId ||
			actor.status !== UserStatus.ACTIVE ||
			!actor.roles?.includes(UserRole.CAMPER)
		) {
			throw new ForbiddenException({ code: "RAG_FORBIDDEN" });
		}
		const settings = this.config.settings();
		const { question, locale } = query ?? {};
		if (
			typeof question !== "string" ||
			question.length > settings.maxQueryLength ||
			!question.trim() ||
			question.includes("\0") ||
			!settings.locales.includes(locale)
		) {
			throw new BadRequestException({ code: "RAG_INVALID_QUERY" });
		}

		const start = performance.now();
		let candidateCount = 0;
		const metrics = (selectedCount: number) => ({
			candidateCount,
			selectedCount,
			durationMs: Math.round(performance.now() - start),
		});
		const insufficient = (reason: InsufficientReason): RagResult => {
			const resultMetrics = metrics(0);
			this.logger.debug({ status: "INSUFFICIENT_CONTEXT", reason, ...resultMetrics });
			return {
				status: "INSUFFICIENT_CONTEXT",
				reason,
				context: "",
				selectedChunks: [],
				sources: [],
				contextTokenCount: 0,
				retrievalConfigVersion: settings.version,
				metrics: resultMetrics,
			};
		};

		if (!(await this.repository.hasEligibleCorpus(locale, settings))) {
			return insufficient("NO_MATCH");
		}
		const vector = await this.embedding.embed(question.trim(), settings.providerTimeoutMs);
		const search = await this.repository.search(locale, vector, settings);
		candidateCount = search.candidateCount;
		const ranked = selectRagChunks(question, search.candidates, settings);
		if (!ranked.length) return insufficient("NO_MATCH");
		const blocks = contextBlocks(ranked);
		if (!blocks.length) return insufficient("CONTEXT_BUDGET");
		const counts = await this.embedding.countPrefixes(blocks, settings.providerTimeoutMs);
		const firstOverflow = counts.findIndex((count) => count > settings.contextTokenBudget);
		const selectedCount = firstOverflow < 0 ? counts.length : firstOverflow;
		if (!selectedCount) return insufficient("CONTEXT_BUDGET");
		const selectedChunks = ranked.slice(0, selectedCount);
		const sources = [
			...new Map(selectedChunks.map((chunk) => [chunk.source.chunkSetId, chunk.source])).values(),
		];
		const eligibility = await this.repository.revalidate(
			selectedChunks,
			locale,
			settings.databaseTimeoutMs
		);
		if (eligibility !== "CURRENT") return insufficient(eligibility);

		const resultMetrics = metrics(selectedCount);
		this.logger.debug({ status: "GROUNDED", ...resultMetrics });
		return {
			status: "GROUNDED",
			context: `[${blocks.slice(0, selectedCount).join(",")}]`,
			selectedChunks,
			sources,
			contextTokenCount: counts[selectedCount - 1],
			retrievalConfigVersion: settings.version,
			metrics: resultMetrics,
		};
	}
}
