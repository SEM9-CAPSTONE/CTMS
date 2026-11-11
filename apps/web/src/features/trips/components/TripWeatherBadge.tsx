import { CloudOff, CloudSun } from "lucide-react";
import { StatusBadge } from "../../../shared/components";
import { WEATHER_RISK_LABELS, WEATHER_RISK_TONES } from "../../weather/utils/weather-risk";
import type { SubmittedWeatherForecastSummary } from "../types";

/** Compact weather status of a submitted Trip for the Admin review list. */
export function TripWeatherBadge({
	forecast,
}: {
	forecast: SubmittedWeatherForecastSummary | null | undefined;
}) {
	if (!forecast) {
		return (
			<StatusBadge tone="neutral" icon={<CloudOff className="size-3.5" />}>
				Chưa có dự báo
			</StatusBadge>
		);
	}
	if (forecast.status === "out_of_range" || !forecast.riskLevel) {
		return (
			<StatusBadge tone="info" icon={<CloudSun className="size-3.5" />}>
				Ngoài phạm vi dự báo
			</StatusBadge>
		);
	}
	return (
		<StatusBadge
			tone={WEATHER_RISK_TONES[forecast.riskLevel]}
			icon={<CloudSun className="size-3.5" />}
		>
			{WEATHER_RISK_LABELS[forecast.riskLevel]}
			{forecast.riskAcknowledged ? " · Host đã xác nhận" : ""}
		</StatusBadge>
	);
}
