import { CheckCircle2, ExternalLink, Scale } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { Modal } from "../../../shared/components/Modal";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { useReviewWeatherPenaltyWaiver } from "../hooks/useWeatherPenalties";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { WeatherPenalty } from "../types";
import {
	WEATHER_PENALTY_STATUS_LABELS,
	WEATHER_PENALTY_STATUS_TONES,
	evidenceFileName,
	formatPenaltyDate,
	formatPenaltyDateTime,
	isReviewOverdue,
	penaltyDisplayStatus,
	weatherPenaltyErrorMessage,
} from "../utils/weather-penalty-labels";

export interface AdminWeatherPenaltyDialogProps {
	penalty: WeatherPenalty;
	onClose: () => void;
	service?: typeof weatherPenaltiesService;
}

/** Policy §6: the Admin reads the penalty and the Host's evidence, then waives or keeps it. */
export function AdminWeatherPenaltyDialog({
	penalty: initial,
	onClose,
	service,
}: AdminWeatherPenaltyDialogProps) {
	const noteId = useId();
	const [penalty, setPenalty] = useState(initial);
	const [note, setNote] = useState("");
	const [pending, setPending] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const review = useReviewWeatherPenaltyWaiver(service);
	const status = penaltyDisplayStatus(penalty);
	const canReview = Boolean(penalty.waiver.requestedAt && !penalty.waiver.decision);

	function ask(approve: boolean) {
		if (!note.trim()) {
			setError("Vui lòng nhập ghi chú (lý do duyệt hoặc từ chối).");
			return;
		}
		setError(null);
		setPending(approve);
	}

	async function submit() {
		if (pending === null) return;
		try {
			const saved = await review.mutateAsync({
				penaltyId: penalty.id,
				input: { approve: pending, note: note.trim() },
			});
			setPenalty(saved);
		} catch (reviewError) {
			setError(weatherPenaltyErrorMessage(reviewError));
		} finally {
			setPending(null);
		}
	}

	return (
		<Modal
			isOpen
			onClose={onClose}
			title={penalty.tripTitle}
			icon={<Scale className="size-5" />}
			description={`Host: ${penalty.hostName ?? penalty.hostId} · Vi phạm lần ${penalty.violationNumber}`}
			size="xl"
			isCloseDisabled={review.isPending}
			closeLabel="Đóng"
		>
			<div className="space-y-4 text-sm text-[#10221b]" data-testid="admin-weather-penalty-dialog">
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge tone={WEATHER_PENALTY_STATUS_TONES[status]}>
						{WEATHER_PENALTY_STATUS_LABELS[status]}
					</StatusBadge>
					{isReviewOverdue(penalty) && <StatusBadge tone="danger">Quá hạn xem xét</StatusBadge>}
				</div>
				<dl className="grid grid-cols-2 gap-3 rounded-2xl border border-[#edf3ed] bg-[#fbfdfb] p-4 text-xs sm:grid-cols-3">
					<div>
						<dt className="text-[#7d8d83]">Khởi hành</dt>
						<dd className="font-bold">{formatPenaltyDateTime(penalty.tripStartsAt)}</dd>
					</div>
					<div>
						<dt className="text-[#7d8d83]">Giá trị booking</dt>
						<dd className="font-bold">{formatBookingMoney(penalty.bookingValue)}</dd>
					</div>
					<div>
						<dt className="text-[#7d8d83]">Mức phạt</dt>
						<dd className="font-bold">
							{penalty.ratePercent}% (tối đa {formatBookingMoney(penalty.capAmount)})
						</dd>
					</div>
					<div>
						<dt className="text-[#7d8d83]">Tiền phạt</dt>
						<dd className="font-bold">{formatBookingMoney(penalty.amount)}</dd>
					</div>
					<div>
						<dt className="text-[#7d8d83]">Đã trừ vào quyết toán</dt>
						<dd className="font-bold">{formatBookingMoney(penalty.deductedAmount)}</dd>
					</div>
					<div>
						<dt className="text-[#7d8d83]">Khoá tạo Trip đến</dt>
						<dd className="font-bold">
							{penalty.hostingBlockedUntil
								? formatPenaltyDate(penalty.hostingBlockedUntil)
								: "Không"}
						</dd>
					</div>
				</dl>

				<div className="rounded-2xl border border-[#edf3ed] p-4 text-xs">
					<p className="font-extrabold">Yêu cầu miễn phạt của Host</p>
					{penalty.waiver.requestedAt ? (
						<>
							<p className="mt-1 text-[#667a6d]">
								Gửi lúc {formatPenaltyDateTime(penalty.waiver.requestedAt)}
								{penalty.waiver.reviewDueAt
									? ` · Hạn xem xét ${formatPenaltyDate(penalty.waiver.reviewDueAt)}`
									: ""}
							</p>
							<p className="mt-2 whitespace-pre-wrap">{penalty.waiver.reason}</p>
							<ul className="mt-2 space-y-1">
								{penalty.waiver.evidenceUrls.map((url) => (
									<li key={url}>
										<a
											href={url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 font-bold text-[#164027] underline"
										>
											<ExternalLink className="size-3.5" />
											{evidenceFileName(url)}
										</a>
									</li>
								))}
							</ul>
						</>
					) : (
						<p className="mt-1 text-[#667a6d]">
							Host chưa gửi yêu cầu. Hạn gửi đến {formatPenaltyDateTime(penalty.waiverDeadline)}.
						</p>
					)}
					{penalty.waiver.decision && (
						<p className="mt-3 flex items-start gap-2 rounded-xl bg-[#f1f5f0] p-3 font-semibold">
							<CheckCircle2 className="size-4 shrink-0 text-[#164027]" />
							{penalty.waiver.decision === "approved" ? "Đã duyệt miễn" : "Đã từ chối"}
							{penalty.waiver.reviewedAt
								? ` lúc ${formatPenaltyDateTime(penalty.waiver.reviewedAt)}`
								: ""}
							: {penalty.waiver.reviewNote}
						</p>
					)}
				</div>

				{canReview && (
					<div className="space-y-3 rounded-2xl border border-[#dfe8df] p-4">
						<label htmlFor={noteId} className="text-xs font-extrabold">
							Ghi chú của Admin (bắt buộc)
						</label>
						<textarea
							id={noteId}
							value={note}
							maxLength={1000}
							rows={3}
							onChange={(event) => setNote(event.target.value)}
							className="w-full rounded-2xl border border-[#dfe8df] p-3 text-sm outline-none focus:border-[#164027]"
						/>
						<div className="flex flex-wrap justify-end gap-2">
							<button
								type="button"
								onClick={() => ask(false)}
								disabled={review.isPending}
								className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
							>
								Từ chối
							</button>
							<button
								type="button"
								onClick={() => ask(true)}
								disabled={review.isPending}
								className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d2617] disabled:opacity-50"
							>
								Duyệt miễn phạt
							</button>
						</div>
					</div>
				)}
				{error && (
					<p
						role="alert"
						className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
					>
						{error}
					</p>
				)}
			</div>
			<ConfirmModal
				isOpen={pending !== null}
				onClose={() => setPending(null)}
				onConfirm={submit}
				title={pending ? "Duyệt miễn phạt?" : "Từ chối miễn phạt?"}
				description={
					pending
						? `Khoản phạt sẽ không còn tính là vi phạm, khoá tạo Trip (nếu có) được mở và ${formatBookingMoney(penalty.deductedAmount)} đã trừ sẽ được hoàn vào ví Host.`
						: "Khoản phạt giữ nguyên và Host thấy ghi chú của bạn."
				}
				confirmText="Xác nhận"
				cancelText="Quay lại"
				variant={pending ? "success" : "danger"}
				isLoading={review.isPending}
			/>
		</Modal>
	);
}
