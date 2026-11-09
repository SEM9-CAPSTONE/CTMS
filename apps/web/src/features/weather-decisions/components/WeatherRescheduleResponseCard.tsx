import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { useWeatherRescheduleResponse } from "../hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import { weatherDecisionErrorMessage } from "../utils/weather-decision-labels";

export interface WeatherRescheduleResponseCardProps {
	bookingId: string;
	newStartsAt: string | null;
	newEndsAt: string | null;
	/** Reloads the booking after the answer was recorded. */
	onAnswered?: () => void;
	service?: typeof weatherDecisionsService;
}

/**
 * Policy §5.2: after a Trip was rescheduled for weather, the Camper keeps the booking on the new
 * date or cancels it with a 100% refund. The server refuses (409) for an ordinary reschedule.
 */
export function WeatherRescheduleResponseCard({
	bookingId,
	newStartsAt,
	newEndsAt,
	onAnswered,
	service,
}: WeatherRescheduleResponseCardProps) {
	const mutation = useWeatherRescheduleResponse(bookingId, service);
	const [pending, setPending] = useState<boolean | null>(null);
	const formatted = (value: string | null) =>
		value ? new Date(value).toLocaleString("vi-VN") : "—";

	async function answer(accept: boolean): Promise<void> {
		try {
			await mutation.mutateAsync(accept);
			onAnswered?.();
		} catch {
			// The error is shown from mutation.error.
		} finally {
			setPending(null);
		}
	}

	return (
		<section
			data-testid="weather-reschedule-response-card"
			className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
					<CalendarClock className="size-5" />
				</div>
				<div>
					<h2 className="text-base font-extrabold text-[#10221b]">Trip đã dời lịch</h2>
					<p className="mt-1 text-xs text-[#667a6d]">
						Lịch mới: {formatted(newStartsAt)} – {formatted(newEndsAt)}. Nếu Trip dời vì thời tiết,
						bạn có thể giữ chỗ ở lịch mới hoặc huỷ và được hoàn 100%.
					</p>
				</div>
			</div>

			{mutation.isSuccess ? (
				<output className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-extrabold text-emerald-800">
					<CheckCircle2 className="size-4 shrink-0" />
					{mutation.data.status === "confirmed"
						? "Bạn đã giữ chỗ ở lịch mới."
						: "Đã huỷ đơn đặt chỗ. Khoản hoàn 100% đang được xử lý."}
				</output>
			) : (
				<>
					{mutation.isError && (
						<p
							role="alert"
							className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900"
						>
							{weatherDecisionErrorMessage(mutation.error)}
						</p>
					)}
					<div className="mt-4 grid gap-2 sm:grid-cols-2">
						<button
							type="button"
							disabled={mutation.isPending}
							onClick={() => setPending(true)}
							className="rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0f2e1c] disabled:opacity-60"
						>
							Giữ chỗ ở lịch mới
						</button>
						<button
							type="button"
							disabled={mutation.isPending}
							onClick={() => setPending(false)}
							className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
						>
							Huỷ và hoàn 100%
						</button>
					</div>
				</>
			)}

			<ConfirmModal
				isOpen={pending !== null}
				onClose={() => setPending(null)}
				onConfirm={() => answer(pending === true)}
				title={pending ? "Giữ chỗ ở lịch mới?" : "Huỷ và nhận hoàn 100%?"}
				description={
					pending
						? `Đơn đặt chỗ sẽ được xác nhận cho lịch ${formatted(newStartsAt)}.`
						: "Đơn đặt chỗ sẽ bị huỷ và bạn được hoàn toàn bộ số tiền đã thanh toán."
				}
				confirmText="Xác nhận"
				cancelText="Quay lại"
				variant={pending ? "success" : "danger"}
				isLoading={mutation.isPending}
			/>
		</section>
	);
}
