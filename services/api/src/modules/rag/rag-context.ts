import type { RagSettings } from "./rag.config";
import { MAX_BLOCK_BYTES, type RagChunk } from "./rag.types";

const STOP_WORDS = new Set(
	"the a an to how what which with i of in for on is it are do does can should you my me and or about please when if be need tell tôi cách làm sao thế nào như gì là về và của một có thể cần khi nếu cho với này đó đang được hãy giúp bạn bị trong không phải".split(" ")
);

function terms(text: string): Set<string> {
	const words = text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
	return new Set(words.filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
}

/** Candidates arrive in descending cosine order. Require lexical corroboration of the match. */
export function selectRagChunks(question: string, candidates: RagChunk[], settings: RagSettings) {
	const queryTerms = [...terms(question)];
	if (!queryTerms.length) return [];
	const minOverlap = Math.min(2, queryTerms.length);
	const selected: RagChunk[] = [];
	const texts = new Set<string>();
	const sourceIds = new Set<string>();
	for (const chunk of candidates) {
		if (chunk.score < settings.minScore) continue;
		const content = chunk.content.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
		if (texts.has(content)) continue;
		const evidence = terms(`${chunk.headings.join(" ")} ${chunk.content}`);
		if (queryTerms.filter((term) => evidence.has(term)).length < minOverlap) continue;
		if (sourceIds.size >= settings.maxSources && !sourceIds.has(chunk.source.documentId)) continue;
		texts.add(content);
		sourceIds.add(chunk.source.documentId);
		selected.push(chunk);
		if (selected.length === settings.topK) break;
	}
	return selected;
}

export function contextBlocks(chunks: RagChunk[]): string[] {
	const blocks: string[] = [];
	for (const { chunkId, headings, content } of chunks) {
		const block = JSON.stringify({ chunkId, headings, content });
		if (Buffer.byteLength(block) > MAX_BLOCK_BYTES) break;
		blocks.push(block);
	}
	return blocks;
}
