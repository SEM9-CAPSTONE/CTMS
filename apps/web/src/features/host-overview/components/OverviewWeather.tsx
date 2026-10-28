import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { cn } from "../../../shared/utils/cn";
import { OVERVIEW_TEXT, WEATHER_FACTOR_LABELS } from "../constants";
import type { OverviewWeather as Weather } from "../types";
import { openOverviewDetail, overviewDate, overviewStatus } from "../utils";

function weatherHeading(weather: Weather): string {
	if (weather.state === "available") return overviewStatus(weather.riskLevel);
	if (weather.state === "stale") return OVERVIEW_TEXT.oldRisk;
	return OVERVIEW_TEXT.weatherUnavailable;
}

function factorValue(value: number | boolean): string | number {
	if (typeof value === "boolean") return value ? "Có" : "Không";
	return value;
}

export function OverviewWeather({
	weather,
	routeName,
	canViewRoute,
	timeZone,
}: { weather: Weather; routeName?: string; canViewRoute: boolean; timeZone: string }) {
	const current = weather.state === "available";
	return (
		<div
			className={cn(
				"rounded-xl border p-3",
				!current && "border-amber-200 bg-amber-50",
				current && weather.riskLevel === "red" && "border-red-200 bg-red-50",
				current && weather.riskLevel !== "red" && "border-[#dfe8df] bg-[#f4f7f2]"
			)}
		>
			<p className="font-bold text-[#10221b]">
				{routeName ?? `Tuyến #${weather.routeId.slice(0, 8)}`}
			</p>
			<p className="mt-1 text-sm font-semibold">{weatherHeading(weather)}</p>
			{!current && weather.riskLevel && (
				<p className="mt-1 text-sm">Đánh giá đã lưu: {overviewStatus(weather.riskLevel)}</p>
			)}
			<p className="mt-2 text-xs text-[#627769]">
				{OVERVIEW_TEXT.observed}: {overviewDate(weather.observedAt, timeZone)}
			</p>
			<p className="mt-1 text-xs text-[#627769]">
				{OVERVIEW_TEXT.assessed}: {overviewDate(weather.assessedAt, timeZone)}
			</p>
			{weather.criteriaScores && (
				<details className="mt-2 text-xs">
					<summary className="cursor-pointer font-semibold">Yếu tố trong đánh giá đã lưu</summary>
					<dl className="mt-2 space-y-1">
						{Object.entries(weather.criteriaScores).map(([key, factor]) => (
							<div key={key} className="flex flex-wrap gap-x-2">
								<dt>{WEATHER_FACTOR_LABELS[key] ?? key}:</dt>
								<dd>
									{factorValue(factor.value)} · {overviewStatus(factor.level)}
								</dd>
							</div>
						))}
					</dl>
				</details>
			)}
			{canViewRoute && (
				<Button
					size="sm"
					variant="ghost"
					className="mt-2"
					onClick={() => openOverviewDetail(RoutePath.HOST_TREKKING_ROUTE_DETAIL, weather.routeId)}
				>
					{OVERVIEW_TEXT.routeDetail}
				</Button>
			)}
		</div>
	);
}
