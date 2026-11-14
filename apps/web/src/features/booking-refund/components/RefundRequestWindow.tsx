import { formatBookingDateTime } from "../../booking-details/utils/booking-details-formatters";
import type { BookingRefundInfo } from "../types";

export function RefundRequestWindow({ info }: { info: BookingRefundInfo }) {
	const window = info.applicableWindow;
	if (!window || (info.refunds.length > 0 && !info.isEligible)) return null;
	const lateReview = info.isEligible && info.policySource === "late_complaint_manual_review";
	return (
		<div className="space-y-2 text-sm">
			<p className="font-semibold">Thời hạn gửi yêu cầu</p>
			<p className="text-[#667a6d]">{window.description}</p>
			{window.deadline && (
				<p className="text-xs text-[#667a6d]">
					Hạn gửi: <strong>{formatBookingDateTime(window.deadline)}</strong>
					{window.isExpired && (
						<span className="ml-2 text-amber-800">
							{lateReview ? "Ngoài thời hạn thông thường" : "(Đã hết hạn)"}
						</span>
					)}
				</p>
			)}
			{lateReview && (
				<p className="text-sm text-amber-800">
					Bạn vẫn có thể gửi yêu cầu sau thời hạn để được xem xét riêng. Hãy nêu rõ khoản cần hoàn
					và lý do gửi muộn. Việc gửi yêu cầu chưa có nghĩa là được chấp thuận hoàn tiền.
				</p>
			)}
		</div>
	);
}
