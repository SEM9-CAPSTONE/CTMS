import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { useWeatherDecisionMutation } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { TripWeatherDecision, WeatherDecision } from "../types";
import {
	WEATHER_DECISION_LABELS,
	fromDateTimeLocalValue,
	weatherDecisionErrorMessage,
} from "../utils/weather-decision-labels";

export interface WeatherDecisionFormProps {
	tripId: string;
	actor: "host" | "admin";
	options: WeatherDecision[];
	/** Shown in the confirm dialog, e.g. that a late Host decision is recorded as late. */
	confirmNote?: string;
	onDecided?: (decision: TripWeatherDecision) => void;
	/** false when the parent shows the confirmation itself (Admin dialog). */
	showSuccess?: boolean;
	service?: typeof weatherDecisionsService;
}

const CONSEQUENCES: Record<WeatherDecision, string> = {
	keep: "Trip vẫn diễn ra theo lịch.",
	reschedule: "Camper được chọn nhận ngày mới hoặc huỷ và hoàn 100%.",
	cancel: "Trip bị huỷ, Camper được hoàn 100%.",
	pause: "Trip tạm dừng: chặn đặt chỗ mới và không tự bắt đầu cho đến khi Admin xử lý tiếp.",
	resume: "Trip mở lại và tiếp tục theo lịch.",
};

/** Shared Keep / Reschedule / Cancel (and Admin Pause / Resume) form with a mandatory reason. */
export function WeatherDecisionForm({
	tripId,
	actor,
	options,
	confirmNote,
	onDecided,
	showSuccess = true,
	service,
}: WeatherDecisionFormProps) {
	const [decision, setDecision] = useState<WeatherDecision>(options[0]);
	const [reason, setReason] = useState("");
	const [safetyPlan, setSafetyPlan] = useState("");
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [localError, setLocalError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [done, setDone] = useState<TripWeatherDecision | null>(null);
	const mutation = useWeatherDecisionMutation(tripId, actor, service);
	const needsPlan = actor === "host" && decision === "keep";

	function validate(): string | null {
		if (!reason.trim()) return "Vui lòng nhập lý do.";
		if (reason.trim().length > 450) return "Lý do tối đa 450 ký tự.";
		if (needsPlan && !safetyPlan.trim()) return "Vui lòng nhập phương án an toàn khi giữ Trip.";
		if (decision === "reschedule") {
			if (!startsAt || !endsAt) return "Vui lòng chọn thời gian bắt đầu và kết thúc mới.";
			if (new Date(endsAt) <= new Date(startsAt))
				return "Thời gian kết thúc phải sau thời gian bắt đầu.";
			if (new Date(startsAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000) {
				return "Thời gian bắt đầu mới phải cách hiện tại ít nhất 24 giờ.";
			}
		}
		return null;
	}

	function requestSubmit(): void {
		const error = validate();
		setLocalError(error);
		if (!error) setConfirming(true);
	}

	async function submit(): Promise<void> {
		try {
			const saved = await mutation.mutateAsync({
				decision,
				reason: reason.trim(),
				...(needsPlan ? { safetyPlan: safetyPlan.trim() } : {}),
				...(decision === "reschedule"
					? { startsAt: fromDateTimeLocalValue(startsAt), endsAt: fromDateTimeLocalValue(endsAt) }
					: {}),
			});
			if (showSuccess) setDone(saved);
			onDecided?.(saved);
		} catch {
			// The error is shown from mutation.error.
		} finally {
			setConfirming(false);
		}
	}

	if (done) {
		return (
			<output className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
				<CheckCircle2 className="size-4 shrink-0" />
				<span className="font-extrabold">
					Đã ghi nhận quyết định: {WEATHER_DECISION_LABELS[done.decision]}.
				</span>
			</output>
		);
	}

	return (
		<div className="space-y-3">
			<div
				aria-label="Chọn quyết định"
				className="grid gap-2 rounded-2xl bg-[#f4f7f2] p-1"
				style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
			>
				{options.map((option) => (
					<button
						key={option}
						type="button"
						aria-pressed={decision === option}
						onClick={() => {
							setDecision(option);
							setLocalError(null);
						}}
						className={`rounded-xl px-2 py-2 text-xs font-extrabold transition ${
							decision === option
								? `bg-white shadow-sm ${option === "cancel" ? "text-rose-800" : "text-[#164027]"}`
								: "text-[#667a6d] hover:bg-white/70"
						}`}
					>
						{WEATHER_DECISION_LABELS[option]}
					</button>
				))}
			</div>
			<p className="text-[11px] text-[#667a6d]">{CONSEQUENCES[decision]}</p>

			{decision === "reschedule" && (
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="block text-xs font-bold text-[#55685a]">
						Bắt đầu mới
						<input
							type="datetime-local"
							value={startsAt}
							onChange={(event) => setStartsAt(event.target.value)}
							className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
						/>
					</label>
					<label className="block text-xs font-bold text-[#55685a]">
						Kết thúc mới
						<input
							type="datetime-local"
							value={endsAt}
							onChange={(event) => setEndsAt(event.target.value)}
							className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
						/>
					</label>
				</div>
			)}

			<label className="block text-xs font-bold text-[#55685a]">
				Lý do (bắt buộc)
				<textarea
					value={reason}
					maxLength={450}
					rows={3}
					onChange={(event) => setReason(event.target.value)}
					className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
				/>
			</label>
			{needsPlan && (
				<label className="block text-xs font-bold text-[#55685a]">
					Phương án an toàn (bắt buộc khi giữ)
					<textarea
						value={safetyPlan}
						maxLength={1000}
						rows={3}
						onChange={(event) => setSafetyPlan(event.target.value)}
						className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b] outline-none focus:border-[#164027]"
					/>
				</label>
			)}

			{(localError || mutation.isError) && (
				<div
					role="alert"
					className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
				>
					<AlertTriangle className="size-4 shrink-0" />
					<span className="font-bold">
						{localError ?? weatherDecisionErrorMessage(mutation.error)}
					</span>
				</div>
			)}

			<button
				type="button"
				onClick={requestSubmit}
				disabled={mutation.isPending}
				className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
					decision === "cancel"
						? "bg-rose-700 hover:bg-rose-800"
						: "bg-[#164027] hover:bg-[#0f2e1c]"
				}`}
			>
				{mutation.isPending && <Loader2 className="size-4 animate-spin" />}
				<span>Gửi quyết định: {WEATHER_DECISION_LABELS[decision]}</span>
			</button>

			<ConfirmModal
				isOpen={confirming}
				onClose={() => setConfirming(false)}
				onConfirm={submit}
				title={`Xác nhận: ${WEATHER_DECISION_LABELS[decision]}`}
				description={
					<span>
						{CONSEQUENCES[decision]}
						{confirmNote ? ` ${confirmNote}` : ""}
					</span>
				}
				confirmText="Xác nhận"
				cancelText="Quay lại"
				variant={decision === "cancel" ? "danger" : "warning"}
				isLoading={mutation.isPending}
			/>
		</div>
	);
}
