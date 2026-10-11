import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import type { BookingRefundInfo, BookingRefundItem } from "../types";
import { RefundStateBadge } from "./RefundStateBadge";

export interface RefundStatusCardProps {
	refundInfo: BookingRefundInfo;
	onRequestRefund: () => void;
	onRetryObligation?: (obligationId: string) => Promise<void>;
	isSubmitting: boolean;
}

export function RefundStatusCard({
	refundInfo,
	onRequestRefund,
	onRetryObligation,
	isSubmitting,
}: RefundStatusCardProps) {
	const hasPendingRefund = refundInfo.refunds.some((r) => r.status === "pending");
	const hasSucceededRefund = refundInfo.refunds.some((r) => r.status === "succeeded");
	const hasFailedRefund = refundInfo.refunds.some((r) => r.status === "failed");

	const windowInfo = refundInfo.applicableWindow;

	return (
		<section
			aria-labelledby="booking-refund-heading"
			className="rounded-3xl bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf3ed] pb-4">
				<h2 id="booking-refund-heading" className="text-lg font-extrabold text-[#10221b]">
					Thông tin hoàn tiền
				</h2>
				<div className="flex flex-wrap gap-2">
					{refundInfo.settlementBlocked && <RefundStateBadge status="blocked" />}
					{refundInfo.awaitingResolution && !hasPendingRefund && (
						<RefundStateBadge status="awaiting_resolution" />
					)}
					{hasPendingRefund && <RefundStateBadge status="pending" />}
					{hasSucceededRefund && !hasPendingRefund && <RefundStateBadge status="succeeded" />}
					{hasFailedRefund && !hasPendingRefund && !hasSucceededRefund && (
						<RefundStateBadge status="failed" />
					)}
				</div>
			</div>

			{refundInfo.settlementBlocked && (
				<div
					role="note"
					className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-950"
				>
					<p className="font-bold">Khoản quyết toán của chuyến đi đang tạm giữ</p>
					<p className="mt-1">
						Do có yêu cầu hoàn tiền hoặc khiếu nại đang chờ xử lý, quyết toán được tạm dừng để đảm
						bảo không tạo payout trước khi giải quyết xong các nghĩa vụ hoàn tiền.
					</p>
				</div>
			)}

			{hasPendingRefund && (
				<output
					aria-live="polite"
					className="mt-4 block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950"
				>
					<p className="font-bold">Đang chờ Quản trị viên đối soát & chuyển khoản</p>
					<p className="mt-1">
						Yêu cầu hoàn tiền đã được tiếp nhận và đang chờ Quản trị viên đối soát, thực hiện chuyển
						khoản thủ công về tài khoản ngân hàng của bạn.
					</p>
				</output>
			)}

			<dl className="mt-4 space-y-3 divide-y divide-[#edf3ed] text-sm">
				{refundInfo.chargeAmount && (
					<div className="flex items-center justify-between pt-2">
						<dt className="text-[#667a6d]">Số tiền đã thanh toán:</dt>
						<dd className="font-bold text-[#10221b]">
							{formatBookingMoney(refundInfo.chargeAmount)}
						</dd>
					</div>
				)}
				<div className="flex items-center justify-between pt-2">
					<dt className="text-[#667a6d]">Đã hoàn tiền:</dt>
					<dd className="font-bold text-emerald-800">
						{formatBookingMoney(refundInfo.totalRefundedAmount)}
					</dd>
				</div>
				<div className="flex items-center justify-between pt-2">
					<dt className="text-[#667a6d]">Còn có thể hoàn:</dt>
					<dd className="font-bold text-[#10221b]">
						<span data-testid="remaining-refundable-amount">
							{formatBookingMoney(refundInfo.remainingRefundableAmount)}
						</span>
					</dd>
				</div>
			</dl>

			{windowInfo && (
				<div className="mt-4 rounded-2xl bg-[#f4f7f2] p-4 text-xs">
					<p className="font-bold text-[#164027]">Khung thời gian yêu cầu:</p>
					<p className="mt-1 text-[#52665b]">{windowInfo.description}</p>
					{windowInfo.deadline && (
						<p className="mt-1 text-[#52665b]">
							Hạn chót:{" "}
							<strong className="text-[#10221b]">
								{formatBookingDateTime(windowInfo.deadline)}
							</strong>
							{windowInfo.isExpired && (
								<span className="ml-2 font-bold text-rose-600">(Đã hết hạn)</span>
							)}
						</p>
					)}
				</div>
			)}

			{refundInfo.refunds.length > 0 && (
				<div className="mt-4 space-y-2.5">
					<p className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
						Lịch sử hoàn tiền
					</p>
					<ul className="space-y-2">
						{refundInfo.refunds.map((refund: BookingRefundItem) => (
							<li
								key={refund.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9ce] p-3 text-xs"
							>
								<div className="space-y-0.5">
									<p className="font-bold text-[#10221b]">{formatBookingMoney(refund.amount)}</p>
									<p className="text-[#667a6d]">
										Ngày tạo: {formatBookingDateTime(refund.createdAt)}
									</p>
									{refund.bankName && (
										<p className="text-[11px] text-[#52665b]">
											Tài khoản nhận: {refund.bankName} - {refund.accountNumber} (
											{refund.accountHolderName})
										</p>
									)}
									{refund.providerReference && (
										<p className="text-[11px] font-semibold text-[#164027]">
											Mã giao dịch đối soát: {refund.providerReference}
										</p>
									)}
									{refund.note && (
										<p className="text-[11px] text-[#52665b]">Ghi chú: {refund.note}</p>
									)}
									{refund.failureReason && (
										<p className="text-[11px] font-semibold text-rose-600">
											Lý do từ chối: {refund.failureReason}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<RefundStateBadge status={refund.status} />
									{refund.status === "failed" && onRetryObligation && (
										<button
											type="button"
											disabled={isSubmitting}
											onClick={() => void onRetryObligation(refund.id)}
											className="rounded-lg border border-rose-700 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
										>
											Thử lại
										</button>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mt-6 flex flex-wrap items-center justify-between gap-3">
				{refundInfo.isEligible && !hasPendingRefund ? (
					<button
						type="button"
						disabled={isSubmitting}
						onClick={onRequestRefund}
						data-testid="open-refund-request-modal"
						className="rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#123320] disabled:opacity-50"
					>
						Gửi yêu cầu hoàn tiền / khiếu nại
					</button>
				) : (
					<p className="text-xs text-[#667a6d]">
						{hasPendingRefund
							? "Đang có yêu cầu hoàn tiền chờ Quản trị viên đối soát."
							: (refundInfo.ineligibleReason ??
								(windowInfo?.isExpired
									? "Đã hết thời hạn yêu cầu hoàn tiền."
									: "Đơn đặt chỗ hiện không trong diện gửi yêu cầu hoàn tiền."))}
					</p>
				)}
			</div>
		</section>
	);
}
