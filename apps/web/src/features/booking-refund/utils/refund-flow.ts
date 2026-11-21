import type { BookingStatus } from "../../booking-details/types";
import type { RefundOrigin } from "../types";

const REFUND_FLOWS = {
	after_trip: {
		automatic: false,
		firstStep: { label: "Gửi yêu cầu", done: "Đã gửi", todo: "Bạn thực hiện" },
		historyTitle: "Yêu cầu đã gửi",
		createdLabel: "Ngày gửi",
		title: "Hoàn tiền sau chuyến đi",
		description:
			"Chuyến đi đã kết thúc. Nếu có khoản thu sai hoặc dịch vụ chưa được cung cấp như cam kết, bạn có thể gửi yêu cầu hoàn tiền để được xem xét.",
		action: "Yêu cầu hoàn tiền sau chuyến đi",
		dialogTitle: "Yêu cầu hoàn tiền sau chuyến đi",
		reasonLabel: "Vấn đề bạn gặp trong chuyến đi",
		reasonPlaceholder: "Ví dụ: Đã thanh toán thêm cho dịch vụ nhưng dịch vụ không được cung cấp.",
	},
	cancelled_booking: {
		automatic: true,
		firstStep: { label: "Hủy đặt chỗ", done: "Đã hủy", todo: "Đã hủy" },
		historyTitle: "Khoản hoàn",
		createdLabel: "Ngày tạo",
		title: "Hoàn tiền sau khi hủy đặt chỗ",
		description:
			"Bạn đã hủy đặt chỗ. Số tiền hoàn được tính tự động theo chính sách hủy áp dụng cho đơn này.",
		action: "Yêu cầu nhận tiền hoàn",
		dialogTitle: "Nhận tiền hoàn sau khi hủy đặt chỗ",
		reasonLabel: "Lý do yêu cầu nhận tiền hoàn",
		reasonPlaceholder: "Nêu lý do hủy đặt chỗ và thông tin cần đối chiếu để nhận tiền hoàn.",
	},
	cancelled_trip: {
		automatic: true,
		firstStep: { label: "Chuyến đi bị hủy", done: "Đã hủy", todo: "Đã hủy" },
		historyTitle: "Khoản hoàn",
		createdLabel: "Ngày tạo",
		title: "Hoàn tiền do chuyến đi bị hủy",
		description:
			"Chuyến đi đã bị hủy. Khoản hoàn cho đơn đặt chỗ được tạo tự động và theo dõi tại đây.",
		action: "Yêu cầu nhận tiền hoàn",
		dialogTitle: "Nhận tiền hoàn do chuyến đi bị hủy",
		reasonLabel: "Thông tin cần đối chiếu",
		reasonPlaceholder: "Nêu khoản thanh toán cần đối chiếu sau khi chuyến đi bị hủy.",
	},
	general: {
		automatic: false,
		firstStep: { label: "Gửi yêu cầu", done: "Đã gửi", todo: "Bạn thực hiện" },
		historyTitle: "Yêu cầu đã gửi",
		createdLabel: "Ngày gửi",
		title: "Thông tin hoàn tiền",
		description: "Theo dõi yêu cầu và kết quả hoàn tiền của đơn đặt chỗ.",
		action: "Gửi yêu cầu hoàn tiền",
		dialogTitle: "Yêu cầu hoàn tiền",
		reasonLabel: "Lý do yêu cầu",
		reasonPlaceholder: "Mô tả khoản thanh toán cần hoàn và lý do yêu cầu.",
	},
} as const;

export type RefundFlow = (typeof REFUND_FLOWS)[keyof typeof REFUND_FLOWS];

export function refundFlow(origin?: RefundOrigin, bookingStatus?: BookingStatus | null) {
	if (origin === "host_trip_cancellation" || origin === "system_trip_cancellation")
		return REFUND_FLOWS.cancelled_trip;
	if (origin === "camper_complaint" || bookingStatus === "completed")
		return REFUND_FLOWS.after_trip;
	if (origin === "camper_cancellation" || bookingStatus === "cancelled")
		return REFUND_FLOWS.cancelled_booking;
	return REFUND_FLOWS.general;
}
