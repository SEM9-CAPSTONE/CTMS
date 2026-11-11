export const DEVICE_SYNC_CONFIG = {
	REFRESH_INTERVAL_MS: 15_000,
	RETRY_BASE_DELAY_MS: 3_000,
	RETRY_MAX_DELAY_MS: 60_000,
	CONFIG_VERSION: "v3",
} as const;

export const SYNC_STATE_LABELS: Record<string, string> = {
	idle: "Sẵn sàng",
	synced: "Đã đồng bộ",
	syncing: "Đang đồng bộ...",
	pending: "Chờ đồng bộ",
	partial_failure: "Đồng bộ một phần",
	failed: "Đồng bộ thất bại",
};
