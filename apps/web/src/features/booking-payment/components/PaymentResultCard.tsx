import { CheckCircle2 } from "lucide-react";
import { formatVND } from "../../trips/components/TripCard";
import type { PayBookingResponse } from "../types";

export interface PaymentResultCardProps {
	result: PayBookingResponse;
}

function formatPaymentTime(isoString: string): string {
	return new Date(isoString).toLocaleString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function PaymentResultCard({ result }: PaymentResultCardProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: Structured payment confirmation details inside status role
		<section
			role="status"
			aria-live="polite"
			aria-label="Kết quả thanh toán"
			className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-emerald-950"
		>
			<div className="flex items-start gap-3">
				<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
				<div>
					<h4 className="text-sm font-extrabold text-emerald-950">Thanh toán thành công!</h4>
					<p className="mt-0.5 text-xs text-emerald-800">
						Đặt chỗ của bạn đã được thanh toán và xác nhận tham gia chuyến đi.
					</p>
				</div>
			</div>

			<dl className="mt-3.5 grid gap-2 border-t border-emerald-200 pt-3 text-xs">
				<div className="flex justify-between gap-3">
					<dt className="text-emerald-800">Mã thanh toán</dt>
					<dd data-testid="authoritative-payment-id" className="break-all font-mono font-bold">
						{result.paymentId}
					</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt className="text-emerald-800">Số tiền đã thanh toán</dt>
					<dd
						data-testid="authoritative-payment-amount"
						className="font-extrabold text-emerald-900"
					>
						{formatVND(Number(result.amount))}
					</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt className="text-emerald-800">Trạng thái thanh toán</dt>
					<dd data-testid="authoritative-payment-status" className="font-bold">
						{result.paymentStatus}
					</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt className="text-emerald-800">Trạng thái đặt chỗ</dt>
					<dd data-testid="authoritative-booking-status" className="font-bold text-emerald-900">
						{result.bookingStatus}
					</dd>
				</div>
				<div className="flex justify-between gap-3">
					<dt className="text-emerald-800">Thời gian xác nhận</dt>
					<dd data-testid="authoritative-payment-time" className="font-medium">
						{formatPaymentTime(result.createdAt)}
					</dd>
				</div>
			</dl>
		</section>
	);
}
