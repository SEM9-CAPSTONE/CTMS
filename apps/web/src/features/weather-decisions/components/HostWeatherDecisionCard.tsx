import { CloudLightning, PauseCircle } from "lucide-react";
import { useWeatherDecisionLog } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import { isPastHostDeadline, weatherDecisionErrorMessage } from "../utils/weather-decision-labels";
import { WeatherDecisionForm } from "./WeatherDecisionForm";
import { WeatherDecisionLog } from "./WeatherDecisionLog";

export interface HostWeatherDecisionCardProps {
	tripId: string;
	/** Reloads the Trip after a cancel or reschedule changed it. */
	onTripChanged?: () => void;
	service?: typeof weatherDecisionsService;
	now?: () => Date;
}

/**
 * Policy §5.2: in the last 3 days, when the newest forecast is Red, the Host keeps, reschedules or
 * cancels with a reason. Hidden otherwise, unless the Trip already has weather decisions.
 */
export function HostWeatherDecisionCard({
	tripId,
	onTripChanged,
	service,
	now = () => new Date(),
}: HostWeatherDecisionCardProps) {
	const query = useWeatherDecisionLog(tripId, true, service);
	const log = query.data;
	if (query.isError) {
		return (
			<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 text-xs shadow-sm">
				<p>{weatherDecisionErrorMessage(query.error)}</p>
				<button type="button" onClick={() => void query.refetch()} className="mt-2 underline">
					Thử lại
				</button>
			</section>
		);
	}
	if (!log) return null;
	const canDecide = log.withinDecisionWindow && log.latestRiskLevel === "red";
	if (!canDecide && log.decisions.length === 0) return null;

	const adminActed = log.decisions.some(
		(entry) => entry.deciderRole === "admin" && entry.tripStartsAt === log.startsAt
	);
	const late = isPastHostDeadline(log.startsAt, now());

	return (
		<section
			data-testid="host-weather-decision-card"
			className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
					<CloudLightning className="size-5" />
				</div>
				<div>
					<h3 className="text-base font-extrabold text-[#10221b]">Quyết định thời tiết</h3>
					<p className="mt-1 text-xs text-[#667a6d]">
						{canDecide
							? "Dự báo ngày đi đang Đỏ. Chọn Giữ / Dời / Huỷ trước mốc 24 giờ trước giờ đi."
							: "Các quyết định thời tiết đã ghi nhận cho Trip này."}
					</p>
				</div>
			</div>

			{log.weatherPausedAt && (
				<p className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
					<PauseCircle className="size-4 shrink-0" />
					Admin đang tạm dừng Trip này: {log.weatherPauseReason}
				</p>
			)}

			<div className="mt-4 space-y-4">
				{canDecide && adminActed && (
					<p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
						Admin đã xử lý Trip này nên Host không quyết định thêm.
					</p>
				)}
				{canDecide && !adminActed && (
					<>
						{late && (
							<p
								data-testid="weather-decision-late-notice"
								className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900"
							>
								Đã quá mốc 24 giờ trước giờ đi: quyết định vẫn được nhận nhưng sẽ ghi là trễ hạn.
							</p>
						)}
						<WeatherDecisionForm
							tripId={tripId}
							actor="host"
							options={["keep", "reschedule", "cancel"]}
							confirmNote={late ? "Quyết định sẽ được ghi là trễ hạn." : undefined}
							onDecided={(decision) => {
								if (decision.decision !== "keep") onTripChanged?.();
							}}
							service={service}
						/>
					</>
				)}
				<div>
					<p className="mb-2 text-xs font-extrabold text-[#10221b]">Nhật ký quyết định</p>
					<WeatherDecisionLog decisions={log.decisions} />
				</div>
			</div>
		</section>
	);
}
