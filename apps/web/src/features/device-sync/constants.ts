export const DEVICE_SYNC_CONFIG = {
	REFRESH_INTERVAL_MS: 15_000,
	RETRY_BASE_DELAY_MS: 3_000,
	RETRY_MAX_DELAY_MS: 60_000,
	CONFIG_VERSION: "v3",
} as const;

export const DEVICE_SYNC_ERRORS = {
	UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
	FORBIDDEN: "Bạn không có quyền xem trạng thái đồng bộ của chuyến đi này.",
	NOT_FOUND: "Không tìm thấy chuyến đi.",
	SERVER_UNAVAILABLE: "Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau.",
	REQUEST_FAILED: "Không thể tải trạng thái đồng bộ. Vui lòng thử lại.",
	CONNECTION_FAILED: "Không thể kết nối máy chủ để đồng bộ. Vui lòng kiểm tra kết nối mạng.",
} as const;

export const SYNC_STATE_LABELS: Record<string, string> = {
	idle: "Sẵn sàng",
	synced: "Đã đồng bộ",
	syncing: "Đang đồng bộ...",
	pending: "Chờ đồng bộ",
	partial_failure: "Đồng bộ một phần",
	failed: "Đồng bộ thất bại",
};
