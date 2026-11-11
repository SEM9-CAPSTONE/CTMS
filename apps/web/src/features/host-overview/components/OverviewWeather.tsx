import { ChevronDown, CloudSun } from "lucide-react";
import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { cn } from "../../../shared/utils/cn";
import { OVERVIEW_TEXT, WEATHER_FACTOR_LABELS } from "../constants";
import type { OverviewWeather as Weather } from "../types";
import { openOverviewDetail, overviewDate, overviewStatus } from "../utils";

function weatherHeading(weather: Weather): string {
	if (weather.state === "available") return overviewStatus(weather.riskLevel);
	if (weather.state === "stale") return OVERVIEW_TEXT.oldRisk;
	return "Chưa khả dụng";
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
	const name = routeName ?? `Tuyến #${weather.routeId.slice(0, 8)}`;
	let badge = "bg-[#f0f3ef] text-[#748177]";
	if (weather.state === "stale") badge = "bg-amber-50 text-amber-700";
	if (current && weather.riskLevel === "red") badge = "bg-red-50 text-red-700";
	if (current && weather.riskLevel === "yellow") badge = "bg-amber-50 text-amber-700";
	if (current && weather.riskLevel === "green") badge = "bg-emerald-50 text-emerald-700";
	return (
		<details className="group">
			<summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg outline-offset-4 [&::-webkit-details-marker]:hidden">
				<span className="rounded-lg bg-[#f2f6f0] p-1.5 text-[#6a8973]">
					<CloudSun aria-hidden="true" className="size-4" />
				</span>
				<span className="min-w-0 flex-1">
					<span
						title={name}
						className="block truncate text-sm font-medium text-[#233c2c] group-open:whitespace-normal"
					>
						{name}
					</span>
					{!current && weather.riskLevel && (
						<span className="mt-0.5 block text-[11px] leading-4 text-[#829087]">
							Đánh giá đã lưu: {overviewStatus(weather.riskLevel)}
						</span>
					)}
					{weather.state === "unavailable" && (
						<span className="mt-0.5 block text-[11px] leading-4 text-[#829087]">
							{OVERVIEW_TEXT.weatherUnavailable}
						</span>
					)}
				</span>
				<span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px] font-medium", badge)}>
					{weatherHeading(weather)}
				</span>
				<ChevronDown
					aria-hidden="true"
					className="size-3 shrink-0 text-[#829087] transition-transform group-open:rotate-180"
				/>
			</summary>
			<div className="ml-10 mt-3 space-y-2 rounded-lg bg-[#f7f9f5] p-3 text-xs text-[#65756a]">
				<p>
					{OVERVIEW_TEXT.observed}: {overviewDate(weather.observedAt, timeZone)}
				</p>
				<p>
					{OVERVIEW_TEXT.assessed}: {overviewDate(weather.assessedAt, timeZone)}
				</p>
				{weather.criteriaScores && (
					<dl className="space-y-1">
						{Object.entries(weather.criteriaScores).map(([key, factor]) => (
							<div key={key} className="flex flex-wrap gap-x-2">
								<dt>{WEATHER_FACTOR_LABELS[key] ?? key}:</dt>
								<dd>
									{factorValue(factor.value)} · {overviewStatus(factor.level)}
								</dd>
							</div>
						))}
					</dl>
				)}
				{canViewRoute && (
					<Button
						size="sm"
						variant="outline"
						onClick={() =>
							openOverviewDetail(RoutePath.HOST_TREKKING_ROUTE_DETAIL, weather.routeId)
						}
					>
						{OVERVIEW_TEXT.routeDetail}
					</Button>
				)}
			</div>
		</details>
	);
}
