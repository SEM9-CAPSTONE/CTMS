import { useState } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
	WEATHER_RISK_LABELS,
	WEATHER_RISK_TONES,
	formatWeatherDateTime,
} from "../../weather/utils/weather-risk";
import { useTripWeatherHistory } from "../hooks/useTripWeatherHistory";
import type { TripWeatherForecast } from "../types";

/**
 * CTMS-93 monitoring: how the forecast for the Trip's dates changed over time. A new row only
 * appears when the result changed; "Kiểm tra lần cuối" shows the monitor is still checking it.
 */
export function TripWeatherHistory({
	tripId,
	fetchHistory,
}: {
	tripId: string;
	fetchHistory?: (tripId: string) => Promise<TripWeatherForecast[]>;
}) {
	const [open, setOpen] = useState(false);
	const query = useTripWeatherHistory(tripId, open, fetchHistory);
	return (
		<details
			data-testid="trip-weather-history"
			className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs text-[#10221b]"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="cursor-pointer font-bold text-[#164027]">Lịch sử thay đổi dự báo</summary>
			{query.isPending && open && <p className="mt-2">Đang tải lịch sử dự báo...</p>}
			{query.isError && (
				<button type="button" onClick={() => void query.refetch()} className="mt-2 underline">
					Không tải được lịch sử dự báo. Thử lại
				</button>
			)}
			{query.data?.length === 0 && <p className="mt-2">Chưa có lịch sử dự báo.</p>}
			{query.data && query.data.length > 0 && (
				<ol className="mt-2 space-y-2">
					{query.data.map((entry) => (
						<li
							key={entry.id}
							data-testid="trip-weather-history-entry"
							className="flex flex-wrap items-center gap-2 border-t border-emerald-50 pt-2 first:border-t-0 first:pt-0"
						>
							<span className="font-semibold">{formatWeatherDateTime(entry.createdAt)}</span>
							{entry.riskLevel ? (
								<StatusBadge tone={WEATHER_RISK_TONES[entry.riskLevel]}>
									{WEATHER_RISK_LABELS[entry.riskLevel]}
								</StatusBadge>
							) : (
								<StatusBadge tone="neutral">Chưa có dự báo</StatusBadge>
							)}
							{entry.compositeScore !== null && <span>Điểm {entry.compositeScore}</span>}
							{entry.checkedAt && entry.checkedAt !== entry.createdAt && (
								<span className="text-slate-600">
									Kiểm tra lần cuối {formatWeatherDateTime(entry.checkedAt)}
								</span>
							)}
						</li>
					))}
				</ol>
			)}
		</details>
	);
}
