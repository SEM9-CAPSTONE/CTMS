import { StatusBadge } from "../../../shared/components/StatusBadge";
import { WEATHER_RISK_LABELS, WEATHER_RISK_TONES } from "../../weather/utils/weather-risk";
import type { TripWeatherDecision } from "../types";
import { WEATHER_DECISION_LABELS } from "../utils/weather-decision-labels";

/** Who decided what, when, on which forecast and why (policy §7). Newest first. */
export function WeatherDecisionLog({ decisions }: { decisions: TripWeatherDecision[] }) {
	if (decisions.length === 0) {
		return <p className="text-xs text-[#667a6d]">Chưa có quyết định thời tiết nào.</p>;
	}
	return (
		<ol className="space-y-2" aria-label="Nhật ký quyết định thời tiết">
			{decisions.map((entry) => (
				<li
					key={entry.id}
					data-testid="weather-decision-entry"
					className="rounded-xl border border-[#edf3ed] bg-[#fbfdfb] p-3 text-xs text-[#10221b]"
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-extrabold">
							{entry.deciderRole === "admin" ? "Admin" : "Host"}
							{entry.deciderName ? ` · ${entry.deciderName}` : ""}
						</span>
						<StatusBadge tone={entry.decision === "cancel" ? "danger" : "neutral"}>
							{WEATHER_DECISION_LABELS[entry.decision]}
						</StatusBadge>
						{entry.riskLevel && (
							<StatusBadge tone={WEATHER_RISK_TONES[entry.riskLevel]}>
								{WEATHER_RISK_LABELS[entry.riskLevel]}
							</StatusBadge>
						)}
						{entry.late && <StatusBadge tone="warning">Trễ hạn</StatusBadge>}
					</div>
					<p className="mt-1 whitespace-pre-wrap">Lý do: {entry.reason}</p>
					{entry.safetyPlan && (
						<p className="mt-1 whitespace-pre-wrap">Phương án an toàn: {entry.safetyPlan}</p>
					)}
					<p className="mt-1 text-[11px] text-slate-600">
						{new Date(entry.createdAt).toLocaleString("vi-VN")}
					</p>
				</li>
			))}
		</ol>
	);
}
