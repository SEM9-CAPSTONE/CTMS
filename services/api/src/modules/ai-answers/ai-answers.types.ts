import { isEnum, isUUID } from "class-validator";
import type { RagEvidenceRef } from "../rag/rag.types";
import { Classification } from "../survival-documents/survival-documents.types";

export const AI_PROMPT_VERSION = "ctms-069-grounded-v2";
export const MAX_GENERATED_ANSWER_CHARS = 2600;
export const MAX_ANSWER_CHARS = 3000;
export const MAX_AI_PAYLOAD_BYTES = 16384;
export const MAX_ANSWER_REQUEST_MS = 8000;
export const AI_REQUEST_LIMIT_MS = 3000;
export const AI_REQUEST_LEASE_MS = 12000;

export type GenerationResult =
	| {
			status: "ANSWERED";
			answerText: string;
			usedEvidenceIds: string[];
			provider: "openai" | "gemini";
			model: string;
			promptVersion: typeof AI_PROMPT_VERSION;
	  }
	| { status: "REFUSED" | "INSUFFICIENT_CONTEXT" };

export type StoredAnswer = {
	id: string;
	request_hash: string;
	locale: string;
	question?: string | null;
	answer: string;
	retrieved_evidence: RagEvidenceRef[];
	cited_chunk_ids: string[];
};

export function citedEvidence(row: StoredAnswer): RagEvidenceRef[] {
	// Historical JSONB may lack fields that are required for newly verified evidence.
	if (!Array.isArray(row.retrieved_evidence)) return [];
	const byId = new Map<string, RagEvidenceRef>();
	for (const ref of row.retrieved_evidence) {
		if (ref && typeof ref.chunkId === "string") byId.set(ref.chunkId, ref);
	}

	const citations: RagEvidenceRef[] = [];
	for (const id of new Set(row.cited_chunk_ids)) {
		const ref = byId.get(id);
		const source = ref?.source;
		if (
			ref &&
			source &&
			isUUID(ref.chunkId) &&
			Number.isInteger(ref.chunkIndex) &&
			ref.chunkIndex >= 0 &&
			isUUID(source.documentId) &&
			isUUID(source.documentVersionId) &&
			isUUID(source.chunkSetId) &&
			Number.isInteger(source.sourceVersion) &&
			source.sourceVersion > 0 &&
			typeof source.sourceTitle === "string" &&
			source.sourceTitle.trim() &&
			isEnum(source.classification, Classification) &&
			source.locale === row.locale &&
			Array.isArray(ref.locations) &&
			ref.locations.length > 0 &&
			ref.locations.every(
				(location) =>
					location &&
					Number.isInteger(location.page) &&
					location.page > 0 &&
					typeof location.itemRef === "string" &&
					location.itemRef.trim()
			)
		) {
			citations.push(ref);
		}
	}
	return citations;
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
			locations: locations.map(({ page, itemRef }) => ({ page, itemRef })),
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
