import type { ReactNode } from "react";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import { AiRiskOpinionNote } from "../../weather-ai-review/components/AiRiskOpinionNote";
import { WeatherRiskCard } from "../../weather/components/WeatherRiskCard";
import { formatWeatherDateTime, toCriterionViews } from "../../weather/utils/weather-risk";
import type { TripWeatherForecast } from "../types";
import {
	FAR_RED_FORECAST_WARNING,
	type TripForecastReliability,
	isFarRedForecast,
	tripForecastReliability,
} from "../utils/trip-forecast-reliability";

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
	/** Admin view shows the forecast attached at submission; traveller is the Camper's view of the trip dates. */
	variant?: "host" | "admin" | "traveller";
	children?: ReactNode;
	/** Clock for the reliability label; injectable for tests. */
	now?: () => Date;
}

const RELIABILITY_TONES: Record<TripForecastReliability, StatusBadgeTone> = {
	low: "neutral",
	medium: "info",
	high: "success",
};

/**
 * Traveller-only context: how reliable the forecast is for the time left before departure, and
 * the "may change, the Host decides" warning for a Red forecast that is still far away.
 */
function TravellerForecastContext({ forecast, now }: { forecast: TripWeatherForecast; now: Date }) {
	const reliability = tripForecastReliability(forecast.tripStartsAt, now);
	return (
		<div className="space-y-2">
			<div
				data-testid="trip-forecast-reliability"
				data-level={reliability.level}
				className="flex flex-wrap items-center gap-2 text-xs text-[#4f6356]"
			>
				<StatusBadge tone={RELIABILITY_TONES[reliability.level]}>{reliability.label}</StatusBadge>
				<span>{reliability.description}</span>
			</div>
			{forecast.checkedAt && (
				<p data-testid="trip-forecast-checked-at" className="text-xs text-[#4f6356]">
					Kiểm tra lần cuối: {formatWeatherDateTime(forecast.checkedAt)}
				</p>
			)}
			{isFarRedForecast(forecast, now) && (
				<p
					data-testid="trip-forecast-far-red-warning"
					className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
				>
					{FAR_RED_FORECAST_WARNING}
				</p>
			)}
		</div>
	);
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
	now = () => new Date(),
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

	const horizonDays = forecast?.horizonDays ?? 15;
	let emptyMessage: string;
	if (variant === "traveller") {
		emptyMessage = outOfRange
			? `Ngày đi còn xa hơn ${horizonDays} ngày nên chưa có dự báo. Dự báo sẽ có khi gần ngày khởi hành; hệ thống không dùng thời tiết hôm nay để thay thế.`
			: "Chưa có dự báo thời tiết cho ngày đi.";
	} else if (outOfRange) {
		emptyMessage = `Ngày trekking nằm ngoài phạm vi dự báo ${horizonDays} ngày nên chưa có dự báo. ${
			variant === "admin"
				? "Admin cân nhắc khi duyệt."
				: "Bạn vẫn có thể gửi duyệt; Admin sẽ cân nhắc."
		}`;
	} else {
		emptyMessage =
			variant === "admin"
				? "Host gửi duyệt khi chưa có dự báo thời tiết (dịch vụ thời tiết không khả dụng)."
				: "Chưa có dự báo thời tiết cho chuyến đi.";
	}
	const titles = {
		host: "Dự báo thời tiết ngày trekking",
		admin: "Dự báo thời tiết lúc gửi duyệt",
		traveller: "Dự báo thời tiết ngày đi",
	} as const;

	return (
		<WeatherRiskCard
			title={titles[variant]}
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
			showAdvice={variant !== "traveller" || Boolean(forecast?.advice)}
			isAdviceLoading={isAdviceLoading}
			adviceError={adviceError}
			onRefresh={onRefresh}
			refreshLabel="Dự báo lại"
			testId="trip-weather-forecast-card"
		>
			{variant === "traveller" && forecast?.status === "available" && (
				<TravellerForecastContext forecast={forecast} now={now()} />
			)}
			{variant !== "traveller" && forecast?.aiReview && (
				<AiRiskOpinionNote review={forecast.aiReview} />
			)}
			{children}
		</WeatherRiskCard>
	);
}
