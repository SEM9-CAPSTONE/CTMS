import { AlertCircle, CloudLightning, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminWeatherDecisionDialog } from "../components/AdminWeatherDecisionDialog";
import { useWeatherDecisionAlerts, useWeatherInterventions } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { WeatherIntervention } from "../types";
import {
	WEATHER_URGENCY_LABELS,
	WEATHER_URGENCY_TONES,
	weatherDecisionErrorMessage,
} from "../utils/weather-decision-labels";

export interface AdminWeatherInterventionsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
	service?: typeof weatherDecisionsService;
}

/**
 * Policy §5.3 / §5.4: Red Trips in the last 3 days that need an Admin now (the Host did not answer
 * by T-24h, or kept the Trip), most urgent first.
 */
export function AdminWeatherInterventionsPage({
	onLogout,
	service,
}: AdminWeatherInterventionsPageProps) {
	const query = useWeatherInterventions(true, service);
	// Keeps the socket open so new reminders refresh this list immediately.
	useWeatherDecisionAlerts({ service });
	const [selected, setSelected] = useState<WeatherIntervention | null>(null);
	const items = query.data ?? [];

	return (
		<AdminLayout activeItem="weather-interventions" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<CloudLightning className="size-7 text-[#164027]" /> Can thiệp thời tiết
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Trip dự báo Đỏ còn tối đa 3 ngày tới giờ đi mà Host chưa phản hồi hoặc chọn Giữ.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void query.refetch()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<RefreshCw className="size-4" /> Làm mới
					</button>
				</div>

				{query.isError && (
					<div
						role="alert"
						className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<AlertCircle className="size-5 shrink-0" />
						{weatherDecisionErrorMessage(query.error)}
					</div>
				)}
				{query.isPending && <p className="text-sm text-[#667a6d]">Đang tải danh sách...</p>}
				{query.isSuccess && items.length === 0 && (
					<p className="rounded-2xl border border-[#dfe8df] bg-white p-6 text-sm text-[#667a6d]">
						Hiện không có Trip nào cần Admin can thiệp.
					</p>
				)}

				{items.length > 0 && (
					<ul className="space-y-3" aria-label="Trip cần can thiệp">
						{items.map((item) => (
							<li key={item.tripId}>
								<button
									type="button"
									data-testid="weather-intervention-row"
									onClick={() => setSelected(item)}
									className="flex w-full flex-col gap-2 rounded-2xl border border-[#dfe8df] bg-white p-4 text-left shadow-sm transition hover:border-[#164027] sm:flex-row sm:items-center sm:justify-between"
								>
									<div>
										<p className="font-extrabold text-[#10221b]">{item.tripTitle}</p>
										<p className="mt-1 text-xs text-[#667a6d]">
											Khởi hành {new Date(item.startsAt).toLocaleString("vi-VN")} ·{" "}
											{item.reason === "host_kept" ? "Host chọn Giữ" : "Host chưa phản hồi"}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										{item.weatherPausedAt && (
											<StatusBadge tone="warning">Đang tạm dừng</StatusBadge>
										)}
										<StatusBadge tone={WEATHER_URGENCY_TONES[item.urgency]}>
											{WEATHER_URGENCY_LABELS[item.urgency]}
										</StatusBadge>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
			{selected && (
				<AdminWeatherDecisionDialog
					key={selected.tripId}
					intervention={selected}
					onClose={() => setSelected(null)}
					service={service}
				/>
			)}
		</AdminLayout>
	);
}
