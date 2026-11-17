import type { StoredAnswer } from "../ai-answers/ai-answers.types";
import type { FeedbackInput, FeedbackRating } from "../ai-answers/ai-feedback.policy";
import type { RagEvidenceRef } from "../rag/rag.types";

type LocalEvidence = Extract<FeedbackInput, { inferenceMode: "LOCAL" }>["evidence"];

export const CasePriority = { UNSAFE: 0, NOT_USEFUL: 1, USEFUL: 2 } as const;
export type CasePriority = (typeof CasePriority)[keyof typeof CasePriority];
export const Processing = {
	PENDING: "PENDING",
	PROCESSING: "PROCESSING",
	COMPLETE: "COMPLETE",
	FAILED: "FAILED",
	SUPERSEDED: "SUPERSEDED",
} as const;
export type Processing = (typeof Processing)[keyof typeof Processing];
export const Review = { PENDING: "pending", REVIEWING: "reviewing", ACTIONED: "actioned" } as const;
export type Review = (typeof Review)[keyof typeof Review];
export const Technical = {
	OPEN: "OPEN",
	HANDED_OFF: "HANDED_OFF",
	VERIFIED_FIX: "VERIFIED_FIX",
	JUSTIFIED_NO_FIX: "JUSTIFIED_NO_FIX",
} as const;
export type Technical = (typeof Technical)[keyof typeof Technical];

export const classifications = [
	"FACTUAL",
	"UNSUPPORTED_CLAIM",
	"SOURCE_MISMATCH",
	"OUTDATED_CONTEXT",
	"INCOMPLETE_ANSWER",
	"SAFETY",
	"UNDETERMINED",
] as const;
export type Classification = (typeof classifications)[number];

export type SourceObservation = {
	evidenceId: number;
	cited: boolean;
	status: "AVAILABLE" | "UNAVAILABLE";
	reference?: Pick<RagEvidenceRef, "chunkId" | "chunkIndex" | "locations" | "fingerprint"> & {
		documentId: string;
		documentVersionId: string;
		chunkSetId: string;
		version: number;
		title: string;
		checksum: string;
		classification: string;
	};
};

export type Snapshot = (
	| {
			mode: "LOCAL";
			local: LocalEvidence;
			installationId: string;
	  }
	| {
			mode: "ONLINE";
			online: Pick<
				StoredAnswer,
				| "locale"
				| "question"
				| "answer"
				| "generation"
				| "retrieval_config_version"
				| "retrieved_evidence"
				| "cited_chunk_ids"
			>;
	  }
) & {
	intake?: {
		receivedAt: string;
		clientActionAt: string;
		rating: FeedbackRating | null;
		reportedUnsafe: boolean;
		reason: string | null;
	};
};

export type Signal = {
	id: string;
	rating: FeedbackRating | null;
	reported_unsafe: boolean;
	reason: string | null;
	reported_at: Date | null;
};

export type Job = {
	id: string;
	feedback_id: string;
	priority: CasePriority;
	rating: FeedbackRating | null;
	attempts: number;
	lease_token: string;
	status: Processing;
};

export type Issue = {
	classification: Classification;
	observation: string;
	suspectedCause: string | null;
	supportingEvidence: number[];
	conflictingEvidence: number[];
	confidence: "LOW" | "MEDIUM" | "HIGH";
	uncertainty: string;
	missingInformation: string[];
	proposedRemediation: string | null;
	regressionCases: Array<{ scenario: string; expected: string }>;
};

export type InvestigationReport = {
	issues: Issue[];
	provider: "openai" | "gemini" | null;
	model: string | null;
	consideredEvidence: number[];
};
