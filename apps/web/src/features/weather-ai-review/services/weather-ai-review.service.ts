import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { WeatherAiAcknowledgeResult, WeatherAiMismatch } from "../types";

export const weatherAiReviewService = {
	listMismatches: () =>
		httpClient.get<WeatherAiMismatch[]>(API_ENDPOINTS.WEATHER.ADMIN_AI_MISMATCHES),
	acknowledge: (forecastId: string) =>
		httpClient.post<WeatherAiAcknowledgeResult>(
			API_ENDPOINTS.WEATHER.ADMIN_AI_MISMATCH_ACKNOWLEDGE(forecastId)
		),
};
