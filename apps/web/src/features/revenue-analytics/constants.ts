export const UNKNOWN_AREA_LABEL = "Chưa xác định khu vực";

/** BR-326. Plain-language date basis shown next to each figure. */
export const DATE_BASIS_HINTS = {
	grossRevenue: "Tính theo ngày khách thanh toán thành công.",
	refundAmount: "Chỉ gồm khoản hoàn đã chuyển xong, tính theo ngày chuyển tiền cho khách.",
	platformFee:
		"Phí ghi nhận tại thời điểm quyết toán chuyến, không tính lại theo mức phí hiện tại.",
	netRevenue:
		"Phần Host được hưởng khi quyết toán chuyến, trừ các khoản hoàn cho khách được duyệt sau quyết toán.",
	payout: "Số tiền đã chuyển vào tài khoản ngân hàng của Host, tính theo ngày chuyển khoản.",
	heldFunds:
		"Tiền khách đã thanh toán cho các chuyến chưa quyết toán. Số dư hiện tại, không lọc theo kỳ.",
	pendingPayout: "Yêu cầu rút tiền đang chờ chuyển khoản. Số dư hiện tại.",
	pendingRefund: "Yêu cầu hoàn tiền của khách chưa chuyển xong. Không tính vào tiền đã hoàn.",
} as const;

export const REVENUE_ERROR_MESSAGES: Record<number, string> = {
	400: "Khoảng thời gian chưa hợp lệ. Vui lòng chọn lại ngày bắt đầu và ngày kết thúc.",
	401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
	403: "Bạn không có quyền xem báo cáo doanh thu này.",
};

export const REVENUE_DEFAULT_ERROR = "Không thể tải báo cáo doanh thu. Vui lòng thử lại sau.";
