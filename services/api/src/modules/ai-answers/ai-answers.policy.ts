import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { contextBlocks } from "../rag/rag-context";
import { MAX_CONTEXT_BLOCKS, type RagResult } from "../rag/rag.types";
import {
	AI_PROMPT_VERSION,
	type GenerationResult,
	MAX_AI_PAYLOAD_BYTES,
	MAX_ANSWER_CHARS,
} from "./ai-answers.types";

const MODEL_NAME = /^[\w.:/-]{1,128}$/;
const MAX_CITED_CHUNKS = 5;
const GUIDANCE_NOTICE_VI =
	"Hướng dẫn chỉ dùng để tham khảo. Nếu có người đang gặp nguy hiểm, hãy liên hệ cấp cứu hoặc lực lượng cứu hộ tại chỗ ngay.";
const GUIDANCE_NOTICE_EN =
	"This guidance is for reference. If someone is in immediate danger, contact local emergency services or rescue personnel now.";

// Whole excerpts preserve qualifications. Screen out unsafe passages even if the model selects them.
const UNSAFE_EXCERPT =
	/https?:\/\/|www\.|ignore.{0,50}instructions|(?:bỏ qua|phớt lờ).{0,50}(?:chỉ dẫn|hướng dẫn|chỉ thị|quy tắc|yêu cầu)|(?:system|developer) prompt|(?:đã|vừa).{0,35}(?:gửi sos|gọi cấp cứu|điều cứu hộ|mở lại tuyến|đổi mức rủi ro|thay đổi quyền|chuyển tiền|hoàn tiền)|\b(?:sos dispatched|route is open|payment approved|access granted)\b|\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|μg|ml|viên)\b|(?:tiêm tĩnh mạch|tiêm bắp|đặt nội khí quản|nắn khớp|rạch vết thương|hút nọc|gây nôn|inject|intubat\w*|induce vomiting)/iu;

export function invalidQuery() {
	return new BadRequestException({ code: "AI_INVALID_QUESTION" });
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
	const { chunkIds, provider, model, promptVersion } = result;
	if (
		result.status !== "ANSWERED" ||
		Object.keys(result).length !== 5 ||
		!Array.isArray(chunkIds) ||
		chunkIds.length < 1 ||
		chunkIds.length > MAX_CITED_CHUNKS ||
		new Set(chunkIds).size !== chunkIds.length ||
		!chunkIds.every((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)) ||
		(provider !== "openai" && provider !== "gemini") ||
		typeof model !== "string" ||
		!MODEL_NAME.test(model) ||
		promptVersion !== AI_PROMPT_VERSION
	)
		throw aiUnavailable();
	return { status: "ANSWERED", chunkIds, provider, model, promptVersion };
}

export function groundedAnswer(
	chunkIds: string[],
	chunks: Extract<RagResult, { status: "GROUNDED" }>["selectedChunks"],
	locale: string
) {
	const byId = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
	const cited = chunkIds.map((id) => {
		const chunk = byId.get(id);
		if (!chunk) throw aiUnavailable();
		return chunk;
	});
	if (
		cited.some(({ content }) =>
			UNSAFE_EXCERPT.test(content.normalize("NFKC").replace(/\s+/gu, " "))
		)
	) {
		return null;
	}
	const bySource = new Map<string, typeof cited>();
	for (const chunk of cited) {
		const group = bySource.get(chunk.source.chunkSetId) ?? [];
		group.push(chunk);
		bySource.set(chunk.source.chunkSetId, group);
	}
	const ordered = [...bySource.values()].flatMap((group) =>
		group.sort((left, right) => left.chunkIndex - right.chunkIndex)
	);
	const notice = locale.split("-")[0] === "en" ? GUIDANCE_NOTICE_EN : GUIDANCE_NOTICE_VI;
	const answer = [notice, ...ordered.map(({ content }) => content.trim())].join("\n\n");
	return answer.length <= MAX_ANSWER_CHARS ? { answer, cited: ordered } : null;
}
