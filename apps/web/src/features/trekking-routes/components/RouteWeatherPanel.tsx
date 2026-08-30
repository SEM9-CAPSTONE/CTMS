import { AlertCircle, CloudRain, Loader2, RefreshCw, Wind } from "lucide-react";
import { useRefreshRouteWeather } from "../hooks/useRefreshRouteWeather";
import { useRouteWeather } from "../hooks/useRouteWeather";
import type { CreatedTrekkingRoute } from "../types";

interface RouteWeatherPanelProps {
	route: CreatedTrekkingRoute;
}

function formatObservedAt(value: string | null): string {
	if (!value) return "";
	return new Date(value).toLocaleString("vi-VN");
}

/**
 * CTMS-25-T02. Reads CTMS-25-T01's real `GET .../weather/latest` on mount /
 * route change, and calls `POST .../weather/refresh` on demand -- never
 * auto-refreshes, matching the Decision Gate this codebase already applies
 * to OTP send/Trip filters/etc: no external call fires without an explicit
 * user action.
 */
export function RouteWeatherPanel({ route }: RouteWeatherPanelProps) {
	const weather = useRouteWeather(route.id);
	const refreshAction = useRefreshRouteWeather();
	const refreshDisabled = route.status !== "active" || refreshAction.isSubmitting;

	const handleRefresh = async () => {
		refreshAction.resetError();
		const updated = await refreshAction.refresh(route.id);
		if (updated) weather.setSnapshot(updated);
	};

	return (
		<section
			className="mt-6 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-weather-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Thời tiết khu vực tuyến đường</h2>
					<p className="mt-1 text-sm text-[#667a6d]">
						Dữ liệu thời tiết gần nhất cho khu vực trung tâm của tuyến.
					</p>
				</div>
				{route.status !== "active" && (
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
						Chỉ làm mới được khi tuyến đang Hoạt động
					</span>
				)}
			</div>

			{weather.isLoading && (
				<div
					data-testid="weather-loading"
					className="mt-4 flex items-center gap-2 text-sm font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin" />
					Đang tải dữ liệu thời tiết...
				</div>
			)}

			{weather.error && !weather.isLoading && (
				<div
					role="alert"
					data-testid="weather-load-error"
					className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<span className="flex items-center gap-2">
						<AlertCircle className="size-5 shrink-0" />
						{weather.error}
					</span>
					<button
						type="button"
						onClick={() => void weather.reload()}
						className="rounded-lg border px-3 py-2 font-bold"
					>
						<RefreshCw className="mr-1 inline size-4" />
						Tải lại
					</button>
				</div>
			)}

			{!weather.isLoading && !weather.error && !weather.snapshot && (
				<p data-testid="weather-empty" className="mt-4 text-sm font-bold text-[#667a6d]">
					Chưa có dữ liệu thời tiết cho tuyến này.
				</p>
			)}

			{!weather.isLoading && !weather.error && weather.snapshot?.status === "failed" && (
				<div
					role="alert"
					data-testid="weather-last-fetch-failed"
					className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
				>
					Lần lấy dữ liệu gần nhất không thành công: {weather.snapshot.errorMessage}
				</div>
			)}

			{!weather.isLoading && !weather.error && weather.snapshot?.status === "success" && (
				<dl
					data-testid="weather-snapshot"
					className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
				>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="flex items-center gap-1 font-bold text-[#425048]">
							<CloudRain className="size-4" /> Lượng mưa
						</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">{weather.snapshot.rainfallMm} mm</dd>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="flex items-center gap-1 font-bold text-[#425048]">
							<Wind className="size-4" /> Gió
						</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">{weather.snapshot.windKph} km/h</dd>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="font-bold text-[#425048]">Nhiệt độ</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">
							{weather.snapshot.temperatureC}°C
						</dd>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="font-bold text-[#425048]">Tầm nhìn</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">{weather.snapshot.visibilityM} m</dd>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="font-bold text-[#425048]">Dông sét</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">
							{weather.snapshot.thunderstorm ? "Có" : "Không"}
						</dd>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<dt className="font-bold text-[#425048]">Thời điểm ghi nhận</dt>
						<dd className="mt-1 font-extrabold text-[#10221b]">
							{formatObservedAt(weather.snapshot.observedAt)}
						</dd>
					</div>
				</dl>
			)}

			{refreshAction.error && (
				<div
					role="alert"
					data-testid="weather-refresh-error"
					className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
				>
					<AlertCircle className="size-5 shrink-0" />
					{refreshAction.error.message}
				</div>
			)}

			<button
				type="button"
				disabled={refreshDisabled}
				onClick={() => void handleRefresh()}
				className="mt-4 flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
			>
				{refreshAction.isSubmitting ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<RefreshCw className="size-4" />
				)}
				{refreshAction.isSubmitting ? "Đang làm mới..." : "Làm mới thời tiết"}
			</button>
		</section>
	);
}
