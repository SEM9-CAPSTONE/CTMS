import { CloudLightning, CreditCard, Lock, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { toast } from "../../../shared/components/Toast";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import {
	useCreateWeatherPenaltyCheckout,
	useMyWeatherPenalties,
} from "../hooks/useWeatherPenalties";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { WeatherPenalty } from "../types";
import {
	WEATHER_PENALTY_STATUS_LABELS,
	WEATHER_PENALTY_STATUS_TONES,
	canRequestWaiver,
	formatPenaltyDate,
	formatPenaltyDateTime,
	hasAmountOwed,
	isPaymentOverdue,
	penaltyDisplayStatus,
	weatherPenaltyErrorMessage,
} from "../utils/weather-penalty-labels";
import { WeatherPenaltyWaiverModal } from "./WeatherPenaltyWaiverModal";

export interface HostWeatherPenaltiesCardProps {
	service?: typeof weatherPenaltiesService;
	connection?: RealtimeConnection;
	now?: () => Date;
	/** Opens the PayOS payment page; replaced in tests. */
	redirect?: (url: string) => void;
}

/** Query parameter PayOS sends the Host back with after paying or cancelling. */
const PAYOS_RETURN_PARAM = "penaltyPayment";

/** Deducted from settlements plus paid through PayOS, as a money string. */
function paidSoFar(penalty: WeatherPenalty): string {
	return (Number(penalty.deductedAmount) + Number(penalty.payment.collectedAmount)).toFixed(2);
}

/** Tells the Host what happened at PayOS, then drops the parameter so a reload stays quiet. */
function useAnnouncePayOSReturn() {
	useEffect(() => {
		const url = new URL(window.location.href);
		const outcome = url.searchParams.get(PAYOS_RETURN_PARAM);
		if (!outcome) return;
		if (outcome === "cancel") {
			toast.info("Bạn đã huỷ thanh toán tiền phạt. Khoản phạt vẫn chờ bạn nộp.");
		} else {
			toast.info("Khoản phạt được cập nhật ngay khi PayOS xác nhận bạn đã thanh toán.");
		}
		url.searchParams.delete(PAYOS_RETURN_PARAM);
		window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
	}, []);
}

/**
 * Policy §6 on the Host wallet: the weather penalties, what is still owed (deducted from the next
 * settlements or paid through PayOS within 7 days), any hosting block, and the waiver request.
 * Hidden when the Host has none.
 */
export function HostWeatherPenaltiesCard({
	service,
	connection,
	now = () => new Date(),
	redirect = (url) => window.location.assign(url),
}: HostWeatherPenaltiesCardProps) {
	const query = useMyWeatherPenalties({ service, connection });
	const checkout = useCreateWeatherPenaltyCheckout(service);
	const [waiverFor, setWaiverFor] = useState<WeatherPenalty | null>(null);
	const [payingId, setPayingId] = useState<string | null>(null);
	useAnnouncePayOSReturn();

	async function payPenalty(penalty: WeatherPenalty) {
		setPayingId(penalty.id);
		try {
			const opened = await checkout.mutateAsync(penalty.id);
			redirect(opened.checkoutUrl);
		} catch (paymentError) {
			toast.error(weatherPenaltyErrorMessage(paymentError));
			setPayingId(null);
		}
	}
	if (query.isError) {
		return (
			<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 text-xs shadow-sm">
				<p>Không tải được khoản phạt thời tiết: {weatherPenaltyErrorMessage(query.error)}</p>
				<button type="button" onClick={() => void query.refetch()} className="mt-2 underline">
					Thử lại
				</button>
			</section>
		);
	}
	const data = query.data;
	if (!data || data.items.length === 0) return null;
	const current = now();

	return (
		<section
			data-testid="host-weather-penalties-card"
			className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e7eee7] pb-4">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
						<CloudLightning className="size-5" />
					</div>
					<div>
						<h2 className="text-base font-extrabold text-[#10221b]">Phạt thời tiết</h2>
						<p className="mt-1 text-xs text-[#667a6d]">
							Phạt khi Admin phải quyết định thay vì bạn không trả lời dự báo Đỏ trước mốc 24 giờ
							trước giờ đi. Tiền phạt tính theo phần doanh thu bạn nhận từ chuyến (sau 5% phí nền
							tảng) và được trừ vào các lần quyết toán tiếp theo. Phần chưa trừ được, bạn nộp qua
							PayOS trong 7 ngày.
						</p>
					</div>
				</div>
				<div className="shrink-0 text-right">
					<p className="text-[11px] font-bold uppercase tracking-wider text-[#7d8d83]">
						Còn phải nộp
					</p>
					<p
						className="text-2xl font-black text-rose-700"
						data-testid="weather-penalty-outstanding"
					>
						{formatBookingMoney(data.outstandingTotal)}
					</p>
				</div>
			</div>

			{data.hostingBlockedUntil && (
				<output
					data-testid="weather-penalty-hosting-block"
					className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
				>
					<Lock className="size-4 shrink-0" />
					{data.suspended
						? `Bạn đang bị đình chỉ tạo Trip do vi phạm nhiều lần trong 90 ngày, đến ${formatPenaltyDate(data.hostingBlockedUntil)}.`
						: `Bạn đang bị khoá tạo Trip mới đến ${formatPenaltyDate(data.hostingBlockedUntil)}.`}{" "}
					Các Trip đã đăng vẫn diễn ra bình thường.
				</output>
			)}

			{Number(data.overdueTotal) > 0 && (
				<output
					data-testid="weather-penalty-overdue"
					className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
				>
					<Wallet className="size-4 shrink-0" />
					Bạn còn {formatBookingMoney(data.overdueTotal)} tiền phạt quá hạn nộp nên chưa tạo hoặc
					gửi duyệt Trip mới được. Sau khi bạn nộp phạt qua PayOS, hệ thống tự ghi nhận và bạn tạo
					Trip lại bình thường.
				</output>
			)}

			<ul className="mt-4 space-y-3">
				{data.items.map((penalty) => {
					const status = penaltyDisplayStatus(penalty);
					return (
						<li
							key={penalty.id}
							data-testid="weather-penalty-item"
							className="rounded-2xl border border-[#edf3ed] bg-[#fbfdfb] p-4 text-xs"
						>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div>
									<p className="text-sm font-extrabold text-[#10221b]">{penalty.tripTitle}</p>
									<p className="mt-0.5 text-[#667a6d]">
										Khởi hành {formatPenaltyDateTime(penalty.tripStartsAt)} · Vi phạm lần{" "}
										{penalty.violationNumber}
									</p>
								</div>
								<StatusBadge tone={WEATHER_PENALTY_STATUS_TONES[status]}>
									{WEATHER_PENALTY_STATUS_LABELS[status]}
								</StatusBadge>
							</div>
							<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
								<div>
									<dt className="text-[#7d8d83]">Doanh thu Host của chuyến</dt>
									<dd className="font-bold">{formatBookingMoney(penalty.bookingValue)}</dd>
								</div>
								<div>
									<dt className="text-[#7d8d83]">Mức phạt</dt>
									<dd className="font-bold">
										{penalty.ratePercent}% (tối đa {formatBookingMoney(penalty.capAmount)})
									</dd>
								</div>
								<div>
									<dt className="text-[#7d8d83]">Tiền phạt / đã trừ hoặc đã nộp</dt>
									<dd className="font-bold">
										{formatBookingMoney(penalty.amount)} / {formatBookingMoney(paidSoFar(penalty))}
									</dd>
								</div>
								<div>
									<dt className="text-[#7d8d83]">Còn phải nộp</dt>
									<dd className="font-bold text-rose-700">
										{formatBookingMoney(penalty.outstandingAmount)}
									</dd>
								</div>
							</dl>
							{hasAmountOwed(penalty) && (
								<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
									<p
										data-testid="weather-penalty-payment-due"
										className={
											isPaymentOverdue(penalty) ? "font-semibold text-rose-700" : "text-[#52665b]"
										}
									>
										{isPaymentOverdue(penalty)
											? `Đã quá hạn nộp (${formatPenaltyDateTime(penalty.payment.dueAt)}).`
											: `Hạn nộp: ${formatPenaltyDateTime(penalty.payment.dueAt)}.`}{" "}
										Nộp qua PayOS bằng mã QR với đúng số còn lại, khoản phạt được ghi nhận tự động.
									</p>
									<button
										type="button"
										onClick={() => void payPenalty(penalty)}
										disabled={payingId !== null}
										className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-60"
									>
										<CreditCard className="size-3.5" />
										{payingId === penalty.id
											? "Đang mở PayOS…"
											: `Nộp phạt ${formatBookingMoney(penalty.outstandingAmount)}`}
									</button>
								</div>
							)}
							{penalty.payment.collectedAt && (
								<p className="mt-3 text-[#52665b]">
									Đã nộp {formatBookingMoney(penalty.payment.collectedAmount)} qua PayOS lúc{" "}
									{formatPenaltyDateTime(penalty.payment.collectedAt)}.
								</p>
							)}
							{status === "waiver_pending" && penalty.waiver.reviewDueAt && (
								<p className="mt-3 text-amber-800">
									Đã gửi yêu cầu miễn phạt. Admin xem xét trước{" "}
									{formatPenaltyDate(penalty.waiver.reviewDueAt)}.
								</p>
							)}
							{penalty.waiver.decision && penalty.waiver.reviewNote && (
								<p className="mt-3 text-[#52665b]">
									Ghi chú của Admin: {penalty.waiver.reviewNote}
								</p>
							)}
							{canRequestWaiver(penalty, current) && (
								<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
									<span className="text-[#667a6d]">
										Có thể xin miễn phạt vì bất khả kháng đến{" "}
										{formatPenaltyDateTime(penalty.waiverDeadline)}.
									</span>
									<button
										type="button"
										onClick={() => setWaiverFor(penalty)}
										className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d2617]"
									>
										Xin miễn phạt
									</button>
								</div>
							)}
						</li>
					);
				})}
			</ul>

			{waiverFor && (
				<WeatherPenaltyWaiverModal
					key={waiverFor.id}
					penalty={waiverFor}
					onClose={() => setWaiverFor(null)}
					onSubmitted={() => toast.success("Đã gửi yêu cầu miễn phạt. Admin sẽ xem xét.")}
					service={service}
				/>
			)}
		</section>
	);
}
