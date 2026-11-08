import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { WeatherRiskLevel } from "../utils/weather-risk";

/** CTMS-93 monitoring: one notice per recipient when a Trip's forecast risk level changes. */
export interface WeatherChangeNotice {
	id: string;
	tripId: string;
	forecastId: string;
	tripTitle: string;
	tripStartsAt: string;
	previousRiskLevel: WeatherRiskLevel;
	riskLevel: WeatherRiskLevel;
	/** true when the level got worse (e.g. Green → Red). */
	worsened: boolean;
	/** Ready-to-show Vietnamese sentence from the server. */
	message: string;
	readAt: string | null;
	createdAt: string;
}

export interface WeatherChangeNoticeList {
	items: WeatherChangeNotice[];
	unreadCount: number;
}

/** Socket payload of `trip.weather.changed`, sent to each recipient's user room. */
export interface TripWeatherChangedEvent {
	eventId: string;
	tripId: string;
	tripTitle: string;
	tripStartsAt: string;
	previousRiskLevel: WeatherRiskLevel;
	riskLevel: WeatherRiskLevel;
	createdAt: string;
}

export const weatherChangeNoticesService = {
	list: () => httpClient.get<WeatherChangeNoticeList>(API_ENDPOINTS.WEATHER.CHANGE_NOTICES),
	markRead: (noticeId: string) =>
		httpClient.patch<WeatherChangeNotice>(API_ENDPOINTS.WEATHER.READ_CHANGE_NOTICE(noticeId)),
};
