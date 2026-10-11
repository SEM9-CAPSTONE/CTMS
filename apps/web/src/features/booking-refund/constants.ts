export const REFUND_STATUS_LABELS = {
	pending: "Đang chờ Quản trị viên đối soát & chuyển khoản",
	succeeded: "Đã hoàn tất chuyển khoản",
	failed: "Yêu cầu bị từ chối / thất bại",
} as const;

export const VIETNAM_POPULAR_BANKS = [
	"Vietcombank",
	"MB Bank (Ngân hàng Quân đội)",
	"Techcombank",
	"BIDV",
	"VietinBank",
	"ACB (Ngân hàng Á Châu)",
	"VPBank",
	"TPBank",
	"Agribank",
	"Sacombank",
	"HDBank",
	"OCB (Phương Đông)",
	"SHB",
	"VIB (Quốc Tế)",
	"MSB (Hàng Hải)",
	"SeABank",
	"Nam A Bank",
	"Bac A Bank",
	"Kienlongbank",
	"Khác (Ngân hàng khác)",
] as const;

export const REFUND_ORIGIN_LABELS = {
	camper_cancellation: "Hủy đặt chỗ trước chuyến đi",
	camper_complaint: "Khiếu nại sau khi hoàn thành chuyến đi",
	host_trip_cancellation: "Host hủy chuyến đi",
	system_trip_cancellation: "Hệ thống hủy chuyến đi",
	late_payment_after_expiry: "Thanh toán trễ sau khi hết hạn",
} as const;

export const REFUND_QUERY_CONFIG = {
	staleTime: 10_000,
	refetchInterval: 30_000,
} as const;
