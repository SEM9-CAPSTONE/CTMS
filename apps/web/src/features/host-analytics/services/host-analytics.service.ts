import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type {
	HostAnalyticsFilterParams,
	HostAnalyticsResponse,
	HostSuggestionHistoryItem,
	HostSuggestionJobResponse,
	QuickCreateContextResponse,
} from "../types";

export const hostAnalyticsService = {
	getAnalytics: async (params: HostAnalyticsFilterParams): Promise<HostAnalyticsResponse> => {
		const search = new URLSearchParams();
		search.set("from", params.from);
		search.set("to", params.to);
		if (params.areaCode) {
			search.set("areaCode", params.areaCode);
		}
		return httpClient.get<HostAnalyticsResponse>(
			`${API_ENDPOINTS.HOST_ANALYTICS.SUMMARY}?${search.toString()}`,
			undefined,
			{ cache: "no-store" }
		);
	},

	createSuggestionJob: async (
		params: HostAnalyticsFilterParams
	): Promise<HostSuggestionJobResponse> => {
		const body: Record<string, unknown> = {
			from: params.from,
			to: params.to,
		};
		if (params.areaCode) {
			body.areaCode = params.areaCode;
		}
		if (params.monthHint) {
			body.monthHint = params.monthHint;
		}
		if (params.excludeRouteIds && params.excludeRouteIds.length > 0) {
			body.excludeRouteIds = params.excludeRouteIds;
		}
		if (params.refresh) {
			body.refresh = true;
		}
		return httpClient.post<HostSuggestionJobResponse>(
			API_ENDPOINTS.HOST_ANALYTICS.SUGGESTIONS,
			body,
			{ cache: "no-store" }
		);
	},

	getLatestSuggestionJob: async (): Promise<HostSuggestionJobResponse> => {
		return httpClient.get<HostSuggestionJobResponse>(
			API_ENDPOINTS.HOST_ANALYTICS.SUGGESTIONS_LATEST,
			undefined,
			{ cache: "no-store" }
		);
	},

	getSuggestionHistory: async (): Promise<HostSuggestionHistoryItem[]> => {
		return httpClient.get<HostSuggestionHistoryItem[]>(
			API_ENDPOINTS.HOST_ANALYTICS.SUGGESTIONS_HISTORY,
			undefined,
			{ cache: "no-store" }
		);
	},

	getSuggestionJobById: async (jobId: string): Promise<HostSuggestionJobResponse> => {
		return httpClient.get<HostSuggestionJobResponse>(
			API_ENDPOINTS.HOST_ANALYTICS.SUGGESTION_JOB(jobId),
			undefined,
			{ cache: "no-store" }
		);
	},

	getQuickCreateContext: async (suggestionId: string): Promise<QuickCreateContextResponse> => {
		return httpClient.get<QuickCreateContextResponse>(
			API_ENDPOINTS.HOST_ANALYTICS.QUICK_CREATE_CONTEXT(suggestionId),
			undefined,
			{ cache: "no-store" }
		);
	},
};
