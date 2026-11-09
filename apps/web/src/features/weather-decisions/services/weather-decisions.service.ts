import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	TripWeatherDecision,
	TripWeatherDecisionLog,
	WeatherDecisionAlert,
	WeatherDecisionAlertList,
	WeatherDecisionInput,
	WeatherIntervention,
	WeatherRescheduleResponseResult,
} from "../types";

export const weatherDecisionsService = {
	getLog: (tripId: string) =>
		httpClient.get<TripWeatherDecisionLog>(API_ENDPOINTS.TRIPS.WEATHER_DECISIONS(tripId)),
	decideAsHost: (tripId: string, input: WeatherDecisionInput) =>
		httpClient.post<TripWeatherDecision>(API_ENDPOINTS.TRIPS.WEATHER_DECISION(tripId), input),
	decideAsAdmin: (tripId: string, input: WeatherDecisionInput) =>
		httpClient.post<TripWeatherDecision>(API_ENDPOINTS.TRIPS.ADMIN_WEATHER_DECISION(tripId), input),
	listInterventions: () =>
		httpClient.get<WeatherIntervention[]>(API_ENDPOINTS.WEATHER.ADMIN_INTERVENTIONS),
	listAlerts: () => httpClient.get<WeatherDecisionAlertList>(API_ENDPOINTS.WEATHER.DECISION_ALERTS),
	markAlertRead: (alertId: string) =>
		httpClient.patch<WeatherDecisionAlert>(API_ENDPOINTS.WEATHER.READ_DECISION_ALERT(alertId)),
	respondToReschedule: (bookingId: string, accept: boolean) =>
		httpClient.post<WeatherRescheduleResponseResult>(
			API_ENDPOINTS.WEATHER.RESCHEDULE_RESPONSE(bookingId),
			{ accept }
		),
};
