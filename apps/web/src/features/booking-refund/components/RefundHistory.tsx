import { Button } from "../../../shared/components";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import type { BookingRefundItem } from "../types";
import { RefundStateBadge } from "./RefundStateBadge";

interface RefundHistoryProps {
	refunds: BookingRefundItem[];
	isSubmitting: boolean;
	onRetry?: (id: string) => Promise<void>;
	title?: string;
	createdLabel?: string;
}

export function RefundHistory({
	refunds,
	isSubmitting,
	onRetry,
	title = "Yêu cầu đã gửi",
	createdLabel = "Ngày gửi",
}: RefundHistoryProps) {
	if (!refunds.length) return null;
	return (
		<div className="space-y-3">
			<h3 className="text-sm font-semibold text-[#10221b]">{title}</h3>
			<ul className="divide-y divide-[#edf3ed]">
				{refunds.map((refund) => (
					<li key={refund.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs">
						<div className="space-y-1">
							<p className="text-sm font-semibold">{formatBookingMoney(refund.amount)}</p>
							<p className="text-[#667a6d]">
								{createdLabel}: {formatBookingDateTime(refund.createdAt)}
							</p>
							{refund.reason && <p>Lý do: {refund.reason}</p>}
							{refund.bankName && (
								<p>
									Tài khoản nhận: {refund.bankName} - {refund.accountNumber} (
									{refund.accountHolderName})
								</p>
							)}
							{refund.providerReference && (
								<p className="text-[#164027]">Mã giao dịch đối soát: {refund.providerReference}</p>
							)}
							{refund.note && <p>Ghi chú: {refund.note}</p>}
							{refund.failureReason && (
								<p className="text-rose-700">Lý do từ chối: {refund.failureReason}</p>
							)}
						</div>
						<div className="flex items-start gap-2">
							<RefundStateBadge status={refund.status} reviewStatus={refund.reviewStatus} />
							{refund.status === "failed" && refund.reviewStatus !== "rejected" && onRetry && (
								<Button
									type="button"
									variant="outline"
									disabled={isSubmitting}
									onClick={() => void onRetry(refund.id)}
								>
									Thử lại
								</Button>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
