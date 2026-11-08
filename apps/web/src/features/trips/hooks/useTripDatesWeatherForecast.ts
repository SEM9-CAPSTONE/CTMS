import { useQuery } from "@tanstack/react-query";
import { HttpError } from "../../../core/api";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../services/trips.service";
import type { TripWeatherForecast } from "../types";

/** The server reuses a forecast for 10 minutes, so refetching more often gains nothing. */
const TRIP_DATES_WEATHER_STALE_MS = 10 * 60_000;

export function tripDatesWeatherErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không tải được dự báo thời tiết. Vui lòng thử lại.";
	const messages: Record<number, string> = {
		404: "Chuyến đi không còn mở để xem dự báo thời tiết.",
		409: "Chuyến đi đã kết thúc hoặc hệ thống chưa cấu hình quy tắc rủi ro thời tiết.",
		422: "Chuyến đi chưa có tuyến hoặc thời gian để dự báo thời tiết.",
		503: "Dịch vụ thời tiết tạm thời không khả dụng. Vui lòng thử lại sau.",
	};
	return messages[error.status] ?? "Không tải được dự báo thời tiết. Vui lòng thử lại.";
}

/**
 * Forecast for the Trip's own dates as shown to travellers: a Trip on 10/11 shows the 10/11
 * forecast, not today's weather.
 */
export function useTripDatesWeatherForecast(
	tripId: string,
	enabled: boolean,
	fetchForecast: (
		tripId: string
	) => Promise<TripWeatherForecast> = tripsService.getTripDatesWeatherForecast
) {
	return useQuery({
		queryKey: queryKeys.trips.tripDatesWeather(tripId),
		queryFn: () => fetchForecast(tripId),
		enabled: enabled && Boolean(tripId),
		staleTime: TRIP_DATES_WEATHER_STALE_MS,
		retry: false,
	});
}
