import { API_ENDPOINTS, httpClient } from "../../core/api";
import { ANALYSIS_PAGE_SIZE } from "./constants";
import type {
	BatchResponse,
	CreateModerationDecisionDto,
	CreateResponse,
	InsightResponse,
	ModerationDecisionResponse,
	ModerationQueueResponse,
	RouteSafetyOverviewResponse,
	SentimentFilter,
	SourceReview,
	TripFeedbackOverviewResponse,
	TripList,
} from "./types";
export const analysisService = {
	trips: (page: number, signal?: AbortSignal) =>
		httpClient.get<TripList>(API_ENDPOINTS.REVIEW_ANALYSIS.TRIPS, { page, limit: 10 }, { signal }),
	insights: (id: string, page: number, signal?: AbortSignal, sentiment: SentimentFilter = "all") =>
		httpClient.get<InsightResponse>(
			API_ENDPOINTS.REVIEW_ANALYSIS.INSIGHTS(id),
			{ page, limit: ANALYSIS_PAGE_SIZE, sentiment: sentiment === "all" ? undefined : sentiment },
			{ signal }
		),
	batch: (trip: string, id: string, signal?: AbortSignal) =>
		httpClient.get<BatchResponse>(API_ENDPOINTS.REVIEW_ANALYSIS.BATCH(trip, id), undefined, {
			signal,
		}),
	create: (trip: string) =>
		httpClient.post<CreateResponse>(API_ENDPOINTS.REVIEW_ANALYSIS.CREATE(trip), {}),
	source: (trip: string, review: string, revision: number, signal?: AbortSignal) =>
		httpClient.get<SourceReview>(
			API_ENDPOINTS.REVIEW_ANALYSIS.SOURCE(trip, review, revision),
			undefined,
			{ signal }
		),
	moderationQueue: (
		params: { status?: string; tripId?: string; page?: number; limit?: number },
		signal?: AbortSignal
	) =>
		httpClient.get<ModerationQueueResponse>(API_ENDPOINTS.HOST_REVIEW_MODERATION.QUEUE, params, {
			signal,
		}),
	recordDecision: (reviewId: string, body: CreateModerationDecisionDto) =>
		httpClient.post<ModerationDecisionResponse>(
			API_ENDPOINTS.HOST_REVIEW_MODERATION.DECISION(reviewId),
			body
		),
	getQuarantinedImageBlob: (reviewId: string, imageIndex: number, signal?: AbortSignal) =>
		httpClient.get<Blob>(
			API_ENDPOINTS.HOST_REVIEW_MODERATION.QUARANTINED_IMAGE(reviewId, imageIndex),
			undefined,
			{ responseType: "blob", signal }
		),
	tripFeedbackOverview: (
		params: { tripId?: string; page?: number; limit?: number },
		signal?: AbortSignal
	) =>
		httpClient.get<TripFeedbackOverviewResponse>(
			API_ENDPOINTS.HOST_REVIEW_ANALYTICS.TRIPS_OVERVIEW,
			params,
			{ signal }
		),
	routeSafetyOverview: (
		params: { routeId?: string; page?: number; limit?: number },
		signal?: AbortSignal
	) =>
		httpClient.get<RouteSafetyOverviewResponse>(
			API_ENDPOINTS.HOST_REVIEW_ANALYTICS.ROUTES_SAFETY_OVERVIEW,
			params,
			{ signal }
		),
};
