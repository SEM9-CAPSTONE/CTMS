import { Button } from "../../../shared/components";
import type { BookingStatus } from "../../booking-details/types";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { BookingRefundInfo } from "../types";
import { refundFlow } from "../utils/refund-flow";
import { RefundHistory } from "./RefundHistory";
import { RefundProgress } from "./RefundProgress";
import { RefundRequestWindow } from "./RefundRequestWindow";
import { RefundStateBadge } from "./RefundStateBadge";

export interface RefundStatusCardProps {
	refundInfo: BookingRefundInfo;
	bookingStatus?: BookingStatus | null;
	onRequestRefund: () => void;
	onRetryObligation?: (obligationId: string) => Promise<void>;
	isSubmitting: boolean;
}

export function RefundStatusCard({
	refundInfo,
	bookingStatus,
	onRequestRefund,
	onRetryObligation,
	isSubmitting,
}: RefundStatusCardProps) {
	const flow = refundFlow(refundInfo.origin, bookingStatus);
	const pending = refundInfo.refunds.find((refund) => refund.status === "pending");
	const latest = pending ?? refundInfo.refunds[0];
	const waitingReview = pending?.reviewStatus === "pending_review";
	const remaining = Number(refundInfo.remainingRefundableAmount);
	const canRequest =
		refundInfo.isEligible && !pending && Number.isFinite(remaining) && remaining > 0;
	const fullyRefunded = Number(refundInfo.totalRefundedAmount) > 0 && remaining <= 0 && !pending;
	let unavailable = "Hiện chưa thể gửi yêu cầu hoàn tiền cho đơn này.";
	if (refundInfo.applicableWindow?.isExpired)
		unavailable = "Đã hết thời hạn gửi yêu cầu hoàn tiền.";
	if (fullyRefunded) unavailable = "Toàn bộ số tiền đã thanh toán đã được hoàn tất.";

	return (
		<section
			aria-labelledby="booking-refund-heading"
			className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 id="booking-refund-heading" className="text-lg font-semibold text-[#10221b]">
					{flow.title}
				</h2>
				{latest && <RefundStateBadge status={latest.status} reviewStatus={latest.reviewStatus} />}
			</div>
			<p className="text-sm leading-relaxed text-[#667a6d]">
				{fullyRefunded
					? "Khoản hoàn đã được xác nhận chuyển về tài khoản ngân hàng của bạn."
					: flow.description}
			</p>
			<RefundProgress refunds={refundInfo.refunds} flow={flow} />
			{refundInfo.settlementBlocked && !pending && (
				<p role="note" className="text-sm text-amber-800">
					Yêu cầu đang được kiểm tra. Bạn có thể theo dõi kết quả xử lý tại đây.
				</p>
			)}
			{pending && (
				<output
					aria-live="polite"
					className="block space-y-2 border-l-2 border-amber-300 pl-4 text-sm"
				>
					<p className="font-semibold">
						{waitingReview ? "Yêu cầu đang chờ xét duyệt" : "Đang chờ chuyển tiền hoàn"}
					</p>
					<p className="text-[#667a6d]">
						{waitingReview
							? "Quản trị viên sẽ xem xét lý do và thông tin bạn cung cấp. Nếu yêu cầu được chấp thuận, tiền sẽ được chuyển về tài khoản ngân hàng của bạn."
							: "Tiền chưa được xác nhận chuyển cho bạn. Kết quả sẽ được cập nhật tại đây sau khi chuyển khoản hoàn tất."}
					</p>
				</output>
			)}
			<dl className="space-y-3 border-b border-[#dfe8df] pb-4 text-sm">
				{refundInfo.chargeAmount && (
					<div className="flex justify-between gap-4">
						<dt className="text-[#667a6d]">Đã thanh toán</dt>
						<dd className="font-semibold">{formatBookingMoney(refundInfo.chargeAmount)}</dd>
					</div>
				)}
				<div className="flex justify-between gap-4">
					<dt className="text-[#667a6d]">Đã hoàn tiền:</dt>
					<dd className="font-semibold text-[#164027]">
						{formatBookingMoney(refundInfo.totalRefundedAmount)}
					</dd>
				</div>
				<div className="flex justify-between gap-4">
					<dt className="text-[#667a6d]">Còn có thể đề nghị hoàn</dt>
					<dd className="font-semibold" data-testid="remaining-refundable-amount">
						{formatBookingMoney(refundInfo.remainingRefundableAmount)}
					</dd>
				</div>
			</dl>
			<RefundRequestWindow info={refundInfo} />
			<RefundHistory
				title={flow.historyTitle}
				createdLabel={flow.createdLabel}
				refunds={refundInfo.refunds}
				isSubmitting={isSubmitting}
				onRetry={onRetryObligation}
			/>
			{canRequest ? (
				<Button
					type="button"
					disabled={isSubmitting}
					onClick={onRequestRefund}
					data-testid="open-refund-request-modal"
				>
					{flow.action}
				</Button>
			) : (
				!pending && <p className="text-sm text-[#667a6d]">{unavailable}</p>
			)}
		</section>
	);
}
