import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	TripPreferences,
	TripPreferencesInput,
	TripRecommendationExplanation,
	TripRecommendations,
} from "../types";

export const tripRecommendationsService = {
	list: (signal?: AbortSignal) =>
		httpClient.get<TripRecommendations>(API_ENDPOINTS.TRIP_RECOMMENDATIONS.LIST, undefined, {
			signal,
		}),
	getPreferences: (signal?: AbortSignal) =>
		httpClient.get<TripPreferences>(API_ENDPOINTS.TRIP_RECOMMENDATIONS.PREFERENCES, undefined, {
			signal,
		}),
	getExplanation: (tripId: string, signal?: AbortSignal) =>
		httpClient.get<TripRecommendationExplanation>(
			API_ENDPOINTS.TRIP_RECOMMENDATIONS.EXPLANATION(tripId),
			undefined,
			{ signal }
		),
	replacePreferences: (input: TripPreferencesInput) =>
		httpClient.put<TripPreferences>(API_ENDPOINTS.TRIP_RECOMMENDATIONS.PREFERENCES, input),
};
