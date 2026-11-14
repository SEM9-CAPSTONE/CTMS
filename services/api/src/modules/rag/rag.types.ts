import type { Classification } from "../survival-documents/survival-documents.types";

export const MAX_QUERY_LENGTH = 2000;
export const MAX_CONTEXT_BLOCKS = 10;
export const MAX_BLOCK_BYTES = 16384;
export const CONTEXT_TOKENIZER = "e5-sentencepiece";

export interface RagQuery {
	question: string;
	locale: string;
}

export interface RagSource {
	documentId: string;
	documentVersionId: string;
	sourceVersion: number;
	checksum: string;
	chunkSetId: string;
	locale: string;
	sourceTitle: string;
	classification: Classification;
	publisher?: string;
	embeddingModel: string;
	embeddingRevision: string;
	embeddingDimensions: number;
	pipelineVersion: string;
	configHash: string;
}

export interface RagChunk {
	chunkId: string;
	chunkIndex: number;
	source: RagSource;
	locations: Array<{ page: number; itemRef: string }>;
	headings: string[];
	content: string;
	score: number;
}

export type InsufficientReason = "NO_MATCH" | "CONTEXT_BUDGET" | "SOURCE_CHANGED" | "INCOMPLETE_EVIDENCE";
export type RagResult = {
	contextTokenCount: number;
	retrievalConfigVersion: string;
	metrics: { candidateCount: number; selectedCount: number; durationMs: number };
} & (
	| { status: "GROUNDED"; context: string; selectedChunks: RagChunk[]; sources: RagSource[] }
	| {
			status: "INSUFFICIENT_CONTEXT";
			reason: InsufficientReason;
			context: "";
			selectedChunks: [];
			sources: [];
	  }
);
