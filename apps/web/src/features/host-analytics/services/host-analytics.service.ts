import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type {
	HostAnalyticsFilterParams,
	HostAnalyticsResponse,
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
		const body: Record<string, string> = {
			from: params.from,
			to: params.to,
		};
		if (params.areaCode) {
			body.areaCode = params.areaCode;
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
