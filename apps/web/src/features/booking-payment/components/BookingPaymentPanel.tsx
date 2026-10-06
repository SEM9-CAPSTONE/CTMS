import { AlertCircle, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatPaymentStatus } from "../../booking-details/utils/booking-details-formatters";
import type { BookingAccess } from "../../trips/components/BookingPanel";
import { formatVND } from "../../trips/components/TripCard";
import type { BookTripResponse } from "../../trips/types";
import { usePayBooking } from "../hooks/usePayBooking";
import {
	DEFAULT_PAYMENT_METHOD,
	PAYMENT_METHOD_OPTIONS,
	payBookingSchema,
} from "../schema/pay-booking.schema";
import type { PayBookingResponse } from "../types";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { PaymentResultCard } from "./PaymentResultCard";

export interface BookingPaymentPanelProps {
	booking: BookTripResponse;
	totalAmount?: string;
	bookingAccess?: BookingAccess;
	onPaymentSuccess?: (response: PayBookingResponse) => void;
}

export function BookingPaymentPanel({
	booking,
	totalAmount,
	bookingAccess = "camper",
	onPaymentSuccess,
}: BookingPaymentPanelProps) {
	const [method, setMethod] = useState(DEFAULT_PAYMENT_METHOD);
	const [validationError, setValidationError] = useState<string | null>(null);
	const { submit, retry, isSubmitting, result, error } = usePayBooking();

	const effectiveAmount = totalAmount ?? booking.totalAmount ?? booking.basePrice;
	const isPayableStatus =
		booking.status === "pending_payment" && booking.paymentStatus === "unpaid";

	if (result) {
		if (result.checkoutUrl && result.paymentStatus === "pending") {
			return (
				// biome-ignore lint/a11y/useSemanticElements: Status block containing PayOS link
				<section
					role="status"
					className="mt-4 rounded-2xl border border-emerald-300 bg-[#f4f8f5] p-5 shadow-xs"
				>
					<div className="flex items-center gap-2">
						<CreditCard className="size-5 text-[#164027]" />
						<h3 className="text-sm font-extrabold text-[#10221b]">
							Cổng thanh toán PayOS (VietQR)
						</h3>
					</div>
					<p className="mt-2 text-xs text-[#52665b]">
						Đơn hàng đã được tạo thành công trên cổng PayOS. Vui lòng quét mã VietQR để hoàn tất
						chuyển khoản ngân hàng. Hệ thống sẽ tự động xác nhận ngay khi nhận được thanh toán.
					</p>
					<div className="mt-4 flex flex-col gap-2">
						<a
							href={result.checkoutUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
						>
							<span>Mở trang thanh toán VietQR</span>
						</a>
						<p className="text-center text-[11px] text-[#667a6d]">
							(Nếu trang thanh toán chưa tự mở, vui lòng bấm vào nút trên)
						</p>
					</div>
				</section>
			);
		}
		return <PaymentResultCard result={result} />;
	}

	if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
		return (
			// biome-ignore lint/a11y/useSemanticElements: Status block containing payment message
			<div
				role="status"
				className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900"
			>
				Đặt chỗ đã được thanh toán và xác nhận thành công.
			</div>
		);
	}

	if (booking.status === "confirmed" && booking.paymentStatus === "not_required") {
		return (
			// biome-ignore lint/a11y/useSemanticElements: Status block containing free booking message
			<div
				role="status"
				className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold text-sky-900"
			>
				Đặt chỗ miễn phí, không yêu cầu thanh toán bổ sung.
			</div>
		);
	}

	if (booking.status === "expired") {
		return (
			// biome-ignore lint/a11y/useSemanticElements: Status block containing authoritative Booking state
			<div
				role="status"
				className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900"
			>
				<p>
					Đơn đặt chỗ đã hết hạn nên không còn thể thanh toán qua quy trình thanh toán thông thường.
				</p>
				<p className="mt-1">Trạng thái thanh toán: {formatPaymentStatus(booking.paymentStatus)}.</p>
			</div>
		);
	}

	if (!isPayableStatus) {
		return (
			<div
				role="alert"
				className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900"
			>
				Đặt chỗ không ở trạng thái có thể thanh toán.
			</div>
		);
	}

	if (bookingAccess === "non-camper") {
		return (
			<div
				role="alert"
				className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900"
			>
				Chỉ tài khoản Camper mới có quyền thanh toán cho đặt chỗ này.
			</div>
		);
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const parseResult = payBookingSchema.safeParse({ method });
		if (!parseResult.success) {
			setValidationError(
				parseResult.error.issues[0]?.message ?? "Vui lòng chọn phương thức thanh toán"
			);
			return;
		}
		setValidationError(null);
		const payResult = await submit(booking.id, parseResult.data);
		if (payResult?.checkoutUrl && typeof window !== "undefined") {
			window.location.href = payResult.checkoutUrl;
			return;
		}
		if (payResult && onPaymentSuccess) {
			onPaymentSuccess(payResult);
		}
	}

	const isSelectedMethodDisabled =
		PAYMENT_METHOD_OPTIONS.find((opt) => opt.id === method)?.disabled ?? false;

	return (
		<section
			aria-labelledby="booking-payment-title"
			className="mt-4 rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-xs"
		>
			<div className="flex items-center gap-2">
				<CreditCard className="size-5 text-[#164027]" />
				<h3 id="booking-payment-title" className="text-sm font-extrabold text-[#10221b]">
					Thanh toán đặt chỗ
				</h3>
			</div>

			<div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#f4f7f2] p-3 text-xs">
				<span className="font-semibold text-[#667a6d]">Số tiền cần thanh toán:</span>
				<span
					data-testid="payment-amount-display"
					className="text-sm font-extrabold text-[#164027]"
				>
					{formatVND(Number(effectiveAmount))}
				</span>
			</div>

			<form onSubmit={handleSubmit} className="mt-3">
				<PaymentMethodSelector
					selectedMethod={method}
					onChange={(val) => {
						setMethod(val);
						setValidationError(null);
					}}
					disabled={isSubmitting}
					fieldError={validationError ?? error?.fieldErrors.method}
				/>

				<button
					type="submit"
					disabled={isSubmitting || isSelectedMethodDisabled}
					className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							<span>Đang xử lý thanh toán...</span>
						</>
					) : (
						<span>Thanh toán ngay</span>
					)}
				</button>
			</form>

			{error && (
				<div
					role="alert"
					className={`mt-3 rounded-xl border p-3 text-xs font-semibold ${
						error.isConflict
							? "border-amber-300 bg-amber-50 text-amber-900"
							: "border-rose-200 bg-rose-50 text-rose-700"
					}`}
				>
					<div className="flex items-start gap-2">
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						<p className="flex-1">{error.message}</p>
					</div>
					{error.canRetry && (
						<button
							type="button"
							onClick={() => void retry()}
							disabled={isSubmitting}
							className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
						>
							{isSubmitting ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<RefreshCw className="size-3" />
							)}
							<span>{isSubmitting ? "Đang thử lại..." : "Thử lại"}</span>
						</button>
					)}
				</div>
			)}
		</section>
	);
}
