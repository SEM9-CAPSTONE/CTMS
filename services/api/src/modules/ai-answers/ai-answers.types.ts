import type { RagEvidenceRef } from "../rag/rag.types";

export const AI_PROMPT_VERSION = "ctms-069-extractive-v1";
export const MAX_ANSWER_CHARS = 3000;
export const MAX_AI_PAYLOAD_BYTES = 16384;
export const MAX_ANSWER_REQUEST_MS = 8000;
export const AI_REQUEST_LIMIT_MS = 3000;
export const AI_REQUEST_LEASE_MS = 12000;

export type GenerationResult =
	| {
			status: "ANSWERED";
			chunkIds: string[];
			provider: "openai" | "gemini";
			model: string;
			promptVersion: typeof AI_PROMPT_VERSION;
	  }
	| { status: "REFUSED" | "INSUFFICIENT_CONTEXT" };

export type StoredAnswer = {
	id: string;
	request_hash: string;
	locale: string;
	answer: string;
	retrieved_evidence: RagEvidenceRef[];
	cited_chunk_ids: string[];
};

export function citedEvidence(row: StoredAnswer): RagEvidenceRef[] {
	const byId = new Map(row.retrieved_evidence.map((ref) => [ref.chunkId, ref]));
	return row.cited_chunk_ids.map((id) => {
		const ref = byId.get(id);
		if (!ref) throw new Error("Stored citation is missing evidence");
		return ref;
	});
}

export function answered(row: StoredAnswer) {
	return {
		status: "ANSWERED" as const,
		answerId: row.id,
		answer: row.answer,
		sources: citedEvidence(row).map(({ source, chunkId, chunkIndex, locations }) => ({
			documentId: source.documentId,
			documentVersionId: source.documentVersionId,
			sourceVersion: source.sourceVersion,
			chunkSetId: source.chunkSetId,
			chunkId,
			chunkIndex,
			title: source.sourceTitle,
			classification: source.classification,
			locale: source.locale,
			locations,
		})),
	};
}

export function unavailableAnswer(code: "AI_KNOWLEDGE_INSUFFICIENT" | "AI_SAFETY_REFUSAL") {
	return {
		status: code === "AI_SAFETY_REFUSAL" ? ("REFUSED" as const) : ("INSUFFICIENT_CONTEXT" as const),
		code,
		answer: null,
		sources: [],
	};
}
