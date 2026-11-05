export const SENTIMENTS = ["positive", "neutral", "negative", "mixed"] as const;
export const TOPICS = [
	"organization",
	"guide_support",
	"safety",
	"itinerary",
	"scenery",
	"facilities",
	"value",
	"communication",
] as const;
export type Sentiment = (typeof SENTIMENTS)[number];
export type Topic = (typeof TOPICS)[number];
export type ItemStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "suppressed";
export interface AnalysisConfig {
	provider: string;
	model: string;
	configVersion: string;
	promptVersion: string;
}
export interface AnalysisOutput {
	sentiment: Sentiment;
	topics: Topic[];
	summary: string;
	confidence: number;
	actualModel: string;
	requestId: string | null;
	usage: { inputTokens: number; outputTokens: number } | null;
}
export interface AnalysisItem {
	id: string;
	review_id: string;
	source_revision: number;
	provider: string;
	model: string;
	config_version: string;
	prompt_version: string;
	status: ItemStatus;
	attempts: number;
	lease_token: string | null;
	lease_until: Date | null;
	next_attempt_at: Date;
	sentiment: Sentiment | null;
	topics: Topic[] | null;
	summary: string | null;
	confidence: number | null;
	actual_model: string | null;
	request_id: string | null;
	input_hash: string | null;
	error_code: string | null;
	created_at: Date;
	updated_at: Date;
}
export interface AnalysisBatch {
	id: string;
	trip_id: string;
	status: string;
	provider: string;
	model: string;
	config_version: string;
	prompt_version: string;
	created_at: Date;
	completed_at: Date | null;
}
export interface ClaimedItem {
	item: AnalysisItem;
	slotId: number;
	token: string;
}
export interface SourceReview {
	id: string;
	revision: number;
	comment: string | null;
	eligible: boolean;
	participationEligible: boolean;
	suppressed: boolean;
}
export class AnalysisProviderError extends Error {
	constructor(
		readonly code: string,
		readonly retryable: boolean
	) {
		super(code);
	}
}
export const BATCH_SIZE = 20;
export const MAX_ATTEMPTS = 3;
export const LEASE_SECONDS = 60;
export const PROMPT_VERSION = "v1";

export interface CoverageRow {
	reviewId: string;
	sourceRevision: number;
	eligible: boolean;
	participationEligible: boolean;
	blocked: boolean;
	suppressed: boolean;
	analysisId: string | null;
	status: ItemStatus | null;
	sentiment: Sentiment | null;
	topics: Topic[] | null;
	summary: string | null;
	confidence: number | null;
	actualModel: string | null;
	analyzedAt: Date | null;
	hasHistory: boolean;
}
