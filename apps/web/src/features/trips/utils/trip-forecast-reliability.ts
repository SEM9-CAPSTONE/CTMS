import type { TripWeatherForecast } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same window as the API booking gate (`TRIP_FORECAST_BLOCKING_WINDOW_MS`): a Red forecast only
 * blocks new bookings when departure is at most 3 days away.
 */
export const TRIP_FORECAST_DECISION_WINDOW_MS = 3 * DAY_MS;
const EARLY_WARNING_WINDOW_MS = 7 * DAY_MS;

export type TripForecastReliability = "low" | "medium" | "high";

export interface TripForecastReliabilityView {
	level: TripForecastReliability;
	label: string;
	description: string;
}

/**
 * How much the forecast for the Trip's own dates can be relied on, from the time left before
 * departure (docs/features/weather-trip-date-decision-policy.md §2). Only the newest forecast counts.
 */
export function tripForecastReliability(
	tripStartsAt: string,
	now: Date = new Date()
): TripForecastReliabilityView {
	const left = new Date(tripStartsAt).getTime() - now.getTime();
	if (left <= TRIP_FORECAST_DECISION_WINDOW_MS) {
		return {
			level: "high",
			label: "Độ tin cậy cao",
			description: "Còn 3 ngày trở xuống: dự báo đủ tin cậy để làm căn cứ quyết định.",
		};
	}
	if (left <= EARLY_WARNING_WINDOW_MS) {
		return {
			level: "medium",
			label: "Cảnh báo sớm",
			description: "Còn 4–7 ngày: dự báo dùng để cảnh báo sớm, vẫn có thể thay đổi.",
		};
	}
	return {
		level: "low",
		label: "Dự báo xa, có thể thay đổi",
		description: "Còn hơn 7 ngày: chỉ để tham khảo, hệ thống sẽ cập nhật bản mới khi gần ngày đi.",
	};
}

/** Red forecast while departure is still more than 3 days away: booking stays open, with a warning. */
export function isFarRedForecast(
	forecast: Pick<TripWeatherForecast, "status" | "riskLevel" | "tripStartsAt"> | null | undefined,
	now: Date = new Date()
): boolean {
	return (
		forecast?.status === "available" &&
		forecast.riskLevel === "red" &&
		new Date(forecast.tripStartsAt).getTime() - now.getTime() > TRIP_FORECAST_DECISION_WINDOW_MS
	);
}

export const FAR_RED_FORECAST_WARNING =
	"Dự báo xấu, có thể thay đổi. Host sẽ quyết định trước ngày đi.";
