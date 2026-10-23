import type { ReactNode } from "react";
import { WeatherRiskCard } from "../../weather/components/WeatherRiskCard";
import { formatWeatherDateTime, toCriterionViews } from "../../weather/utils/weather-risk";
import type { TripWeatherForecast } from "../types";

export interface TripWeatherForecastCardProps {
	forecast: TripWeatherForecast | null;
	isLoading: boolean;
	error: string | null;
	isAdviceLoading?: boolean;
	adviceError?: string | null;
	/** Re-runs the forecast (Host); shown as the card's action button. */
	onRefresh?: () => void;
	/** Retries loading after an error (both views). */
	onRetry?: () => void;
	/** Admin view shows the forecast attached at submission. */
	variant?: "host" | "admin";
	children?: ReactNode;
}

function hourHint(at: string | null | undefined): string | undefined {
	return at ? `Xấu nhất lúc ${formatWeatherDateTime(at)}` : undefined;
}

/** Forecast for the Trip's trekking days, rendered with the shared weather card. */
export function TripWeatherForecastCard({
	forecast,
	isLoading,
	error,
	isAdviceLoading = false,
	adviceError = null,
	onRefresh,
	onRetry,
	variant = "host",
	children,
}: TripWeatherForecastCardProps) {
	const worst = forecast?.worstReading ?? null;
	const outOfRange = forecast?.status === "out_of_range";
	const scheduleText = forecast
		? `${formatWeatherDateTime(forecast.tripStartsAt)} – ${formatWeatherDateTime(forecast.tripEndsAt)}`
		: "";

	const notice =
		forecast && forecast.status === "available" && !forecast.coversWholeTrip && forecast.forecastTo
			? `Dự báo mới phủ tới ${formatWeatherDateTime(forecast.forecastTo)}; phần còn lại của chuyến đi chưa có dữ liệu dự báo.`
			: undefined;

	const emptyMessage = outOfRange
		? `Ngày trekking nằm ngoài phạm vi dự báo ${forecast?.horizonDays ?? 15} ngày nên chưa có dự báo. ${
				variant === "admin"
					? "Admin cân nhắc khi duyệt."
					: "Bạn vẫn có thể gửi duyệt; Admin sẽ cân nhắc."
			}`
		: variant === "admin"
			? "Host gửi duyệt khi chưa có dự báo thời tiết (dịch vụ thời tiết không khả dụng)."
			: "Chưa có dự báo thời tiết cho chuyến đi.";

	return (
		<WeatherRiskCard
			title={
				variant === "admin" ? "Dự báo thời tiết lúc gửi duyệt" : "Dự báo thời tiết ngày trekking"
			}
			subtitle={
				forecast
					? `Dự báo cho lịch trình ${scheduleText}, lấy giờ xấu nhất của từng tiêu chí.`
					: "Dự báo theo đúng thời gian của chuyến đi, không phải thời tiết hôm nay."
			}
			isLoading={isLoading}
			error={error}
			onRetry={onRetry ?? onRefresh}
			riskLevel={forecast?.riskLevel ?? null}
			compositeScore={forecast?.compositeScore ?? null}
			assessedAt={forecast?.createdAt ?? null}
			criteria={
				forecast?.criteriaScores
					? toCriterionViews(forecast.criteriaScores, {
							rainfall: hourHint(worst?.rainfallAt),
							wind: hourHint(worst?.windAt),
							temperature: hourHint(worst?.temperatureAt),
							visibility: hourHint(worst?.visibilityAt),
							thunderstorm: hourHint(worst?.thunderstormAt),
						})
					: []
			}
			emptyMessage={emptyMessage}
			notice={notice}
			advice={
				forecast?.advice ? { text: forecast.advice.text, actions: forecast.advice.actions } : null
			}
			isAdviceLoading={isAdviceLoading}
			adviceError={adviceError}
			onRefresh={onRefresh}
			refreshLabel="Dự báo lại"
			testId="trip-weather-forecast-card"
		>
			{children}
		</WeatherRiskCard>
	);
}
