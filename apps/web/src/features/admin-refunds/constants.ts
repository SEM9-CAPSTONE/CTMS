export const ADMIN_REFUND_STATUS_TABS = [
	{ key: "all", label: "Tất cả" },
	{ key: "pending", label: "Chờ xử lý" },
	{ key: "succeeded", label: "Đã chuyển tiền" },
	{ key: "failed", label: "Đã từ chối" },
] as const;

export const ADMIN_REFUNDS_PAGE_SIZE = 15;
