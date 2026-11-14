import { createHash } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: Nest injection
import { RagRetrievalService } from "../rag/rag-retrieval.service";
// biome-ignore lint/style/useImportType: Nest injection
import { RagRepository, evidenceRef } from "../rag/rag.repository";
import { MAX_QUERY_LENGTH } from "../rag/rag.types";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { aiUnavailable, generationInput, groundedAnswer, invalidQuery } from "./ai-answers.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { AiAnswersRepository } from "./ai-answers.repository";
import {
	MAX_ANSWER_REQUEST_MS,
	type StoredAnswer,
	answered,
	citedEvidence,
	unavailableAnswer,
} from "./ai-answers.types";
// biome-ignore lint/style/useImportType: Nest injection
import { AiGenerationProvider } from "./ai-generation.provider";

function ensureCamper(actor: AuthenticatedUser) {
	if (actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.CAMPER)) {
		throw new ForbiddenException({ code: "AI_FORBIDDEN" });
	}
}

function withinDeadline<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = () => reject(aiUnavailable("AI_TIMEOUT"));
		if (signal.aborted) timeout();
		else signal.addEventListener("abort", timeout, { once: true });
		void task.then(resolve, reject).finally(() => signal.removeEventListener("abort", timeout));
	});
}

type AnswerInput = { requestId: string; question: string; locale: string };

@Injectable()
export class AiAnswersService {
	private readonly logger = new Logger(AiAnswersService.name);

	constructor(
		private readonly rag: RagRetrievalService,
		private readonly evidence: RagRepository,
		private readonly provider: AiGenerationProvider,
		private readonly repository: AiAnswersRepository
	) {}

	async ask(actor: AuthenticatedUser, input: AnswerInput) {
		ensureCamper(actor);
		const { requestId, locale } = input;
		const question = input.question.trim();
		if (!question || input.question.length > MAX_QUERY_LENGTH || question.includes("\0")) {
			throw invalidQuery();
		}
		const requestHash = createHash("sha256")
			.update(JSON.stringify({ question, locale }))
			.digest("hex");
		const signal = AbortSignal.timeout(MAX_ANSWER_REQUEST_MS);
		const startedAt = performance.now();
		const timings: Record<string, number> = {};
		const telemetry: Record<string, string> = { requestId, outcome: "AI_UNAVAILABLE" };
		const measure = async <T>(stage: string, task: () => Promise<T>): Promise<T> => {
			const start = performance.now();
			try {
				return await task();
			} finally {
				timings[stage] = Math.round(performance.now() - start);
			}
		};

		let leaseId: string | null = null;
		try {
			const stored = await withinDeadline(
				this.repository.findByRequest(actor.userId, requestId),
				signal
			);
			if (stored) {
				const result = await this.replay(stored, requestHash, signal);
				telemetry.outcome = result.status;
				return result;
			}
			const acquired = await withinDeadline(
				this.repository.acquire(actor.userId).then((id) => {
					if (id && signal.aborted) this.release(actor.userId, id, requestId);
					return id;
				}),
				signal
			);
			if (!acquired) {
				throw new HttpException({ code: "AI_RATE_LIMITED" }, HttpStatus.TOO_MANY_REQUESTS);
			}
			leaseId = acquired;
			const completed = await withinDeadline(
				this.repository.findByRequest(actor.userId, requestId),
				signal
			);
			if (completed) {
				const result = await this.replay(completed, requestHash, signal);
				telemetry.outcome = result.status;
				return result;
			}

			const rag = await measure("retrievalMs", () =>
				withinDeadline(this.rag.retrieve(actor, { question, locale }), signal).catch(
					(error: unknown) => {
						if (error instanceof BadRequestException) throw invalidQuery();
						throw aiUnavailable(signal.aborted ? "AI_TIMEOUT" : "RETRIEVAL_UNAVAILABLE");
					}
				)
			);
			telemetry.retrievalConfigVersion = rag.retrievalConfigVersion;
			telemetry.outcome = "INSUFFICIENT_CONTEXT";
			if (rag.status === "INSUFFICIENT_CONTEXT") {
				telemetry.reason = rag.reason;
				return unavailableAnswer("AI_KNOWLEDGE_INSUFFICIENT");
			}
			const body = generationInput(rag, question, locale);
			if (!body) return unavailableAnswer("AI_KNOWLEDGE_INSUFFICIENT");

			const generation = await measure("providerMs", () => this.provider.generate(body, signal));
			if (generation.status === "INSUFFICIENT_CONTEXT") {
				telemetry.reason = "GENERATION_TOKEN_BUDGET";
				return unavailableAnswer("AI_KNOWLEDGE_INSUFFICIENT");
			}
			const validateAndSave = async () => {
				const verified =
					generation.status === "ANSWERED"
						? groundedAnswer(generation.chunkIds, rag.selectedChunks, locale)
						: null;
				if (!verified || generation.status !== "ANSWERED")
					return unavailableAnswer("AI_SAFETY_REFUSAL");
				const retrieved = rag.selectedChunks.map(evidenceRef);
				const cited = verified.cited.map(evidenceRef);
				const saved = await this.evidence.withCurrentEvidence(
					retrieved,
					locale,
					this.remaining(startedAt),
					(manager) => {
						if (signal.aborted) throw aiUnavailable("AI_TIMEOUT");
						return this.repository.save(
							manager,
							actor.userId,
							acquired,
							requestId,
							{
								request_hash: requestHash,
								locale,
								answer: verified.answer,
								retrieved_evidence: retrieved,
								cited_chunk_ids: cited.map(({ chunkId }) => chunkId),
							},
							{
								provider: generation.provider,
								model: generation.model,
								promptVersion: generation.promptVersion,
							},
							rag.retrievalConfigVersion
						);
					},
					cited
				);
				if (signal.aborted) throw aiUnavailable("AI_TIMEOUT");
				return saved ? answered(saved) : unavailableAnswer("AI_KNOWLEDGE_INSUFFICIENT");
			};
			const result = await measure("validationAndPersistenceMs", () =>
				withinDeadline(validateAndSave(), signal)
			);
			if (generation.status === "ANSWERED") {
				const { model, provider, promptVersion } = generation;
				Object.assign(telemetry, { model, provider, promptVersion });
			}
			telemetry.outcome = result.status;
			return result;
		} catch (error) {
			const failure = signal.aborted
				? aiUnavailable("AI_TIMEOUT")
				: error instanceof HttpException
					? error
					: aiUnavailable();
			const response = failure.getResponse();
			telemetry.outcome =
				typeof response === "object" && "code" in response
					? String(response.code)
					: "AI_UNAVAILABLE";
			throw failure;
		} finally {
			if (leaseId) {
				this.release(actor.userId, leaseId, requestId);
			}
			this.logger.log({
				...telemetry,
				...timings,
				durationMs: Math.round(performance.now() - startedAt),
			});
		}
	}

	async sources(actor: AuthenticatedUser, answerId: string) {
		ensureCamper(actor);
		const stored = await this.repository.findForOwner(actor.userId, answerId).catch(() => {
			throw aiUnavailable();
		});
		if (!stored) throw new NotFoundException({ code: "AI_ANSWER_NOT_FOUND" });
		return { answerId, sources: answered(stored).sources };
	}

	private release(userId: string, leaseId: string, requestId: string) {
		void this.repository
			.release(userId, leaseId)
			.catch(() => this.logger.warn({ requestId, outcome: "AI_LEASE_RELEASE_FAILED" }));
	}

	private remaining(startedAt: number): number {
		const remaining = MAX_ANSWER_REQUEST_MS - Math.ceil(performance.now() - startedAt);
		if (remaining < 1) throw aiUnavailable("AI_TIMEOUT");
		return Math.min(remaining, 1500);
	}

	private async replay(row: StoredAnswer, requestHash: string, signal: AbortSignal) {
		if (row.request_hash !== requestHash) {
			throw new ConflictException({ code: "AI_REQUEST_ID_CONFLICT" });
		}
		return (
			(await withinDeadline(
				this.evidence.withCurrentEvidence(
					row.retrieved_evidence,
					row.locale,
					1500,
					async () => answered(row),
					citedEvidence(row)
				),
				signal
			)) ?? unavailableAnswer("AI_KNOWLEDGE_INSUFFICIENT")
		);
	}
}
