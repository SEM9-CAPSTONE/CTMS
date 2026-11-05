export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type Topic =
	| "organization"
	| "guide_support"
	| "safety"
	| "itinerary"
	| "scenery"
	| "facilities"
	| "value"
	| "communication";
export type ItemStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "suppressed";
export interface Configuration {
	provider: string;
	model: string;
	configVersion: string;
	promptVersion: string;
}
export interface Batch extends Configuration {
	id: string;
	tripId: string;
	status: "pending" | "running" | "succeeded" | "partial" | "failed" | "completed";
	createdAt: string;
	completedAt: string | null;
}
export interface Insight {
	id: string;
	reviewId: string;
	sourceRevision: number;
	sentiment: Sentiment;
	topics: Topic[];
	summary: string;
	confidence: number;
	actualModel: string;
	analyzedAt: string;
}
export interface InsightResponse {
	tripId: string;
	configuration: Configuration;
	latestBatch: Batch | null;
	retryAfterSeconds: number;
	coverage: {
		eligible: number;
		analyzed: number;
		pending: number;
		failed: number;
		stale: number;
		unprocessed: number;
		excluded: number;
		ratio: number;
	};
	freshness: { reviewChanged: number; configurationChanged: number; restricted: number };
	sentimentCounts: Record<Sentiment, number>;
	topics: { topic: Topic; count: number; denominator: number }[];
	items: Insight[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface BatchResponse {
	batch: Batch;
	remainingCount: number;
	hasMore: boolean;
	progress: Record<ItemStatus | "total", number>;
	items: {
		id: string;
		reviewId: string;
		sourceRevision: number;
		status: ItemStatus;
		current: boolean;
		freshnessReason: string | null;
		errorCode: string | null;
		analysis: Omit<Insight, "id" | "reviewId" | "sourceRevision" | "analyzedAt"> | null;
	}[];
}
export interface CreateResponse {
	batch: Batch;
	reused: boolean;
	remainingCount: number;
	hasMore: boolean;
}
export interface TripList {
	items: { id: string; title: string; status: string }[];
	pagination: { page: number; total: number; totalPages: number };
}
export interface SourceReview {
	reviewId: string;
	revision: number;
	currentRevision: number;
	rating: number;
	comment: string | null;
	createdAt: string;
}

export type SentimentFilter = Sentiment | "all";
