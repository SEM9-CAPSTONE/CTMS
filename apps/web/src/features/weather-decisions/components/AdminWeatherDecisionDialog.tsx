import { CheckCircle2, CloudLightning } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { useWeatherDecisionLog } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { WeatherDecision, WeatherIntervention } from "../types";
import {
	WEATHER_DECISION_LABELS,
	WEATHER_URGENCY_LABELS,
	WEATHER_URGENCY_TONES,
	weatherDecisionErrorMessage,
} from "../utils/weather-decision-labels";
import { WeatherDecisionForm } from "./WeatherDecisionForm";
import { WeatherDecisionLog } from "./WeatherDecisionLog";

export interface AdminWeatherDecisionDialogProps {
	intervention: WeatherIntervention | null;
	onClose: () => void;
	service?: typeof weatherDecisionsService;
}

/** Policy §5.3: the Admin reviews the Host's answer and decides, including pause and resume. */
export function AdminWeatherDecisionDialog({
	intervention,
	onClose,
	service,
}: AdminWeatherDecisionDialogProps) {
	const tripId = intervention?.tripId ?? "";
	const log = useWeatherDecisionLog(tripId, Boolean(intervention), service);
	// Kept here: a pause/resume reloads the log and remounts the form with the new options.
	const [recorded, setRecorded] = useState<WeatherDecision | null>(null);
	if (!intervention) return null;
	const paused = Boolean(log.data?.weatherPausedAt ?? intervention.weatherPausedAt);
	const options: WeatherDecision[] = paused
		? ["resume", "keep", "reschedule", "cancel"]
		: ["keep", "pause", "reschedule", "cancel"];

	return (
		<Modal
			isOpen
			onClose={onClose}
			title={intervention.tripTitle}
			icon={<CloudLightning className="size-5" />}
			description={`Khởi hành ${new Date(intervention.startsAt).toLocaleString("vi-VN")}`}
			size="xl"
			closeLabel="Đóng"
		>
			<div className="space-y-4 text-sm text-[#10221b]" data-testid="admin-weather-decision-dialog">
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge tone={WEATHER_URGENCY_TONES[intervention.urgency]}>
						{WEATHER_URGENCY_LABELS[intervention.urgency]}
					</StatusBadge>
					<StatusBadge tone="danger">Dự báo Đỏ</StatusBadge>
					{paused && <StatusBadge tone="warning">Đang tạm dừng</StatusBadge>}
				</div>
				{intervention.reason === "host_kept" ? (
					<div className="rounded-2xl border border-[#edf3ed] bg-[#fbfdfb] p-3 text-xs">
						<p className="font-extrabold">Host chọn Giữ</p>
						<p className="mt-1 whitespace-pre-wrap">Lý do: {intervention.hostDecisionReason}</p>
						<p className="mt-1 whitespace-pre-wrap">
							Phương án an toàn: {intervention.hostSafetyPlan}
						</p>
					</div>
				) : (
					<p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
						Host chưa phản hồi trước mốc 24 giờ trước giờ đi.
					</p>
				)}
				{recorded && (
					<output className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-extrabold text-emerald-800">
						<CheckCircle2 className="size-4 shrink-0" />
						Đã ghi nhận quyết định: {WEATHER_DECISION_LABELS[recorded]}.
					</output>
				)}
				{!recorded || recorded === "pause" || recorded === "resume" ? (
					<WeatherDecisionForm
						key={`${intervention.tripId}-${paused}`}
						tripId={intervention.tripId}
						actor="admin"
						options={options}
						showSuccess={false}
						onDecided={(saved) => setRecorded(saved.decision)}
						service={service}
					/>
				) : null}
				<div>
					<p className="mb-2 text-xs font-extrabold">Nhật ký quyết định</p>
					{log.isError && <p className="text-xs">{weatherDecisionErrorMessage(log.error)}</p>}
					{log.isPending && <p className="text-xs">Đang tải nhật ký...</p>}
					{log.data && <WeatherDecisionLog decisions={log.data.decisions} />}
				</div>
			</div>
		</Modal>
	);
}
