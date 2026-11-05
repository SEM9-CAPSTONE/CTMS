import { API_ENDPOINTS, httpClient } from "../../core/api";
import { ANALYSIS_PAGE_SIZE } from "./constants";
import type {
	BatchResponse,
	CreateResponse,
	InsightResponse,
	SentimentFilter,
	SourceReview,
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
};
