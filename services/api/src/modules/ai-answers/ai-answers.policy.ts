import {
	BadRequestException,
	ForbiddenException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { contextBlocks } from "../rag/rag-context";
import { MAX_CONTEXT_BLOCKS, type RagResult } from "../rag/rag.types";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { answerSafetyV1 } from "./ai-answer-safety-v1";
import {
	AI_PROMPT_VERSION,
	type GenerationResult,
	MAX_AI_PAYLOAD_BYTES,
	MAX_GENERATED_ANSWER_CHARS,
} from "./ai-answers.types";
import { MODEL_IDENTIFIER, parseProviderInferenceTrace } from "./ai-inference-trace";

const MAX_CITED_CHUNKS = 5;

export function invalidQuery() {
	return new BadRequestException({ code: "AI_INVALID_QUESTION" });
}

export function ensureCamper(actor: AuthenticatedUser) {
	if (actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.CAMPER)) {
		throw new ForbiddenException({ code: "AI_FORBIDDEN" });
	}
}

export function aiUnavailable(code = "AI_UNAVAILABLE") {
	return new ServiceUnavailableException({ code });
}

export function generationInput(
	rag: Extract<RagResult, { status: "GROUNDED" }>,
	question: string,
	locale: string
) {
	const { selectedChunks, context, contextTokenCount, retrievalConfigVersion } = rag;
	const blocks = contextBlocks(selectedChunks);
	if (
		!selectedChunks.length ||
		selectedChunks.length > MAX_CONTEXT_BLOCKS ||
		new Set(selectedChunks.map(({ chunkId }) => chunkId)).size !== selectedChunks.length ||
		blocks.length !== selectedChunks.length ||
		context !== `[${blocks.join(",")}]` ||
		!Number.isInteger(contextTokenCount) ||
		contextTokenCount < 1 ||
		!retrievalConfigVersion ||
		retrievalConfigVersion.length > 100 ||
		selectedChunks.some(({ source, locations }) => source.locale !== locale || !locations.length)
	)
		throw aiUnavailable("RETRIEVAL_UNAVAILABLE");
	const body = JSON.stringify({ question, locale, evidence: JSON.parse(context) as unknown });
	return Buffer.byteLength(body) <= MAX_AI_PAYLOAD_BYTES ? body : null;
}

export function parseGeneration(value: unknown): GenerationResult {
	if (!value || typeof value !== "object") throw aiUnavailable();
	const result = value as Record<string, unknown>;
	if (
		(result.status === "REFUSED" || result.status === "INSUFFICIENT_CONTEXT") &&
		Object.keys(result).length === 1
	)
		return { status: result.status };
	const { answerText, usedEvidenceIds, provider, model, promptVersion } = result;
	if (
		result.status !== "ANSWERED" ||
		Object.keys(result).length !== 7 ||
		typeof answerText !== "string" ||
		!answerText.trim() ||
		answerText.length > MAX_GENERATED_ANSWER_CHARS ||
		answerText.includes("\0") ||
		!Array.isArray(usedEvidenceIds) ||
		usedEvidenceIds.length < 1 ||
		usedEvidenceIds.length > MAX_CITED_CHUNKS ||
		new Set(usedEvidenceIds).size !== usedEvidenceIds.length ||
		!usedEvidenceIds.every(
			(id): id is string =>
				typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)
		) ||
		(provider !== "openai" && provider !== "gemini") ||
		typeof model !== "string" ||
		!MODEL_IDENTIFIER.test(model) ||
		promptVersion !== AI_PROMPT_VERSION
	)
		throw aiUnavailable();
	const trace = parseProviderInferenceTrace(result.trace, provider);
	if (!trace) throw aiUnavailable();
	return { status: "ANSWERED", answerText, usedEvidenceIds, provider, model, promptVersion, trace };
}

export function groundedAnswer(
	generation: Extract<GenerationResult, { status: "ANSWERED" }>,
	chunks: Extract<RagResult, { status: "GROUNDED" }>["selectedChunks"],
	locale: string
) {
	const byId = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
	const cited = generation.usedEvidenceIds.map((id) => {
		const chunk = byId.get(id);
		if (!chunk) throw aiUnavailable();
		return chunk;
	});
	const answer = answerSafetyV1.apply(
		generation.answerText,
		cited.map(({ content }) => content),
		locale
	);
	return answer === null ? null : { answer, cited };
}
