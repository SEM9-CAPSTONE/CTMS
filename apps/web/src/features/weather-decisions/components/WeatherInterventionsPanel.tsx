import { AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { useWeatherDecisionAlerts, useWeatherInterventions } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { WeatherIntervention } from "../types";
import {
	WEATHER_URGENCY_LABELS,
	WEATHER_URGENCY_TONES,
	weatherAutoCancelNotice,
	weatherDecisionErrorMessage,
} from "../utils/weather-decision-labels";
import { AdminWeatherDecisionDialog } from "./AdminWeatherDecisionDialog";

export interface WeatherInterventionsPanelProps {
	service?: typeof weatherDecisionsService;
}

/**
 * "Cần xử lý" tab of Admin › Quản lý thời tiết (policy §5.3 / §5.4): Red Trips leaving within 3
 * days whose Host did not answer by T-24h or wants to keep going, most urgent first.
 */
export function WeatherInterventionsPanel({ service }: WeatherInterventionsPanelProps) {
	const query = useWeatherInterventions(true, service);
	// Keeps the socket open so new reminders refresh this list immediately.
	useWeatherDecisionAlerts({ service });
	const [selected, setSelected] = useState<WeatherIntervention | null>(null);
	const items = query.data ?? [];

	return (
		<section className="space-y-4" data-testid="weather-interventions-panel">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-[#667a6d]">
					Các Trip khởi hành trong 3 ngày tới đang báo thời tiết xấu (Đỏ) mà Host chưa xử lý, hoặc
					Host vẫn muốn đi. Trip gấp nhất nằm trên cùng.
				</p>
				<button
					type="button"
					onClick={() => void query.refetch()}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#f1f5f0]"
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
			{query.isPending && <p className="text-sm text-[#667a6d]">Đang tải...</p>}
			{query.isSuccess && items.length === 0 && (
				<p className="rounded-2xl border border-[#dfe8df] bg-white p-6 text-sm text-[#667a6d]">
					Chưa có Trip nào cần bạn xử lý.
				</p>
			)}

			{items.length > 0 && (
				<ul className="space-y-3" aria-label="Trip cần xử lý">
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
										{item.reason === "host_kept" ? "Host muốn giữ chuyến" : "Host chưa trả lời"}
									</p>
									{item.reason === "no_response" && (
										<p
											data-testid="weather-intervention-auto-cancel"
											className="mt-1 text-xs font-semibold text-rose-800"
										>
											{weatherAutoCancelNotice(item.startsAt)}
										</p>
									)}
								</div>
								<div className="flex flex-wrap gap-2">
									{item.weatherPausedAt && <StatusBadge tone="warning">Đang tạm dừng</StatusBadge>}
									<StatusBadge tone={WEATHER_URGENCY_TONES[item.urgency]}>
										{WEATHER_URGENCY_LABELS[item.urgency]}
									</StatusBadge>
								</div>
							</button>
						</li>
					))}
				</ul>
			)}
			{selected && (
				<AdminWeatherDecisionDialog
					key={selected.tripId}
					intervention={selected}
					onClose={() => setSelected(null)}
					service={service}
				/>
			)}
		</section>
	);
}
