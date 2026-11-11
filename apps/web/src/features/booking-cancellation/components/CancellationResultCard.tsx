import { formatBookingDateTime } from "../../booking-details/utils/booking-details-formatters";
import type { CancelBookingResponse } from "../types";

const refundLabels = {
	pending: "Hoàn tiền đang chờ xử lý, chưa hoàn tất.",
	succeeded: "Hoàn tiền đã hoàn tất.",
	failed: "Hoàn tiền thất bại. Đơn đặt chỗ vẫn đã hủy.",
} as const;

export function CancellationResultCard({ result }: { result: CancelBookingResponse }) {
	return (
		<section
			aria-label="Kết quả hủy"
			aria-live="polite"
			className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950"
		>
			<h2 className="font-extrabold">Đã xác nhận hủy đơn đặt chỗ</h2>
			<p className="mt-2 text-sm">
				Đơn đặt chỗ không còn quyền tham gia chuyến đi, kể cả khi hoàn tiền đang chờ hoặc thất bại.
			</p>
			{result.cancelledAt && (
				<p className="mt-2 text-sm">Thời điểm hủy: {formatBookingDateTime(result.cancelledAt)}</p>
			)}
			{result.refund && (
				<div className="mt-3 rounded-xl bg-white p-3 text-sm">
					<p>{refundLabels[result.refund.status]}</p>
					<p>
						Số tiền hoàn theo máy chủ:{" "}
						<strong data-testid="cancellation-refund-amount">{result.refund.amount}</strong>
					</p>
				</div>
			)}
		</section>
	);
}
