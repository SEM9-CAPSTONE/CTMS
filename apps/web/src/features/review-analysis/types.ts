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
	rating?: number;
	sentiment: Sentiment;
	topics: Topic[];
	summary: string;
	confidence: number;
	actualModel: string;
	createdAt?: string;
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
	items: {
		id: string;
		title: string;
		status: string;
		routeId?: string;
		routeName?: string;
	}[];
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

export type ModerationStatus = "visible" | "hidden";

export type ImageStorageState =
	| "live"
	| "quarantine_pending"
	| "quarantined"
	| "quarantine_failed"
	| "restore_pending"
	| "restore_failed";

export type ModerationFlagType =
	| "profanity_or_insult"
	| "harassment"
	| "hate_speech"
	| "inappropriate_image"
	| "spam_or_irrelevant"
	| "contact_info_leak"
	| "other";

export type DetectionSource =
	| "regex"
	| "perspective_api"
	| "gemini_safety"
	| "rekognition"
	| "admin"
	| "system";

export type HostModerationDecisionAction = "keep" | "hide" | "restore";

export interface ModerationFlagItem {
	id: string;
	flagType: ModerationFlagType;
	channel: "text" | "image";
	detectionSource: DetectionSource;
	confidence: number | null;
	evidence: string;
	quote: string | null;
	targetImageIndex: number | null;
	createdAt: string;
}

export interface ModerationQueueItem {
	reviewId: string;
	tripId: string;
	tripTitle: string;
	reviewerId: string;
	rating: number;
	comment: string | null;
	images: string[];
	sourceRevision: number;
	createdAt: string;
	moderationStatus: ModerationStatus;
	imageStorageState: ImageStorageState;
	hiddenReason: ModerationFlagType | null;
	activeFlags: ModerationFlagItem[];
}

export interface ModerationQueueResponse {
	items: ModerationQueueItem[];
	total: number;
	page: number;
	limit: number;
}

export interface CreateModerationDecisionDto {
	expectedRevision: number;
	decision: HostModerationDecisionAction;
	reason?: ModerationFlagType;
	note?: string;
}

export interface ModerationDecisionResponse {
	decisionId: string;
	reviewId: string;
	revision: number;
	decision: HostModerationDecisionAction;
	reason: ModerationFlagType | null;
	moderationStatus: ModerationStatus;
	imageStorageState: ImageStorageState;
	adminActionedOverride: boolean;
	message: string;
	createdAt: string;
}

export type AspectType = "safety" | "guide_support" | "equipment" | "value";

export interface AspectSentimentSummary {
	positive: number;
	neutral: number;
	negative: number;
	netScore: number | null;
}

export interface TripFeedbackItem {
	tripId: string;
	tripTitle: string;
	routeId?: string;
	routeName?: string;
	totalReviews: number;
	analyzedReviewsCount: number;
	coverageRate: number;
	reportedReviewsExcludedCount: number;
	hasSufficientSample: boolean;
	aspects: Record<AspectType, AspectSentimentSummary>;
}

export interface TripFeedbackOverviewResponse {
	items: TripFeedbackItem[];
	total: number;
	page: number;
	limit: number;
	sampleThreshold: number;
}

export type IncidentType = "fall_slip" | "injury" | "lost_path" | "weather_hazard" | "other";
export type IncidentSeverity = "minor" | "moderate" | "severe" | "unknown";

export interface IncidentSignalSummary {
	category: IncidentType;
	occurredCount: number;
	warningCount: number;
	unknownCount: number;
	severityBreakdown: Record<IncidentSeverity, number>;
	sampleQuotes: string[];
}

export interface RouteSafetyItem {
	routeId: string;
	routeName: string;
	totalReviews: number;
	analyzedReviewsCount: number;
	coverageRate: number;
	reportedReviewsExcludedCount: number;
	hasSufficientSample: boolean;
	totalDistinctReviewsWithIncidents: number;
	totalDistinctReviewsWithWarnings: number;
	incidentSignals: IncidentSignalSummary[];
}

export interface RouteSafetyOverviewResponse {
	items: RouteSafetyItem[];
	total: number;
	page: number;
	limit: number;
	sampleThreshold: number;
	categoryCountsCannotBeSummed: boolean;
	notSafetyHotspots: boolean;
}

export type ReviewAnalysisTab = "insights" | "moderation_queue" | "trip_feedback" | "route_safety";
