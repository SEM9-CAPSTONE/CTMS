import type {
	IncidentCategory,
	IncidentLocationStatus,
	IncidentMediaState,
	IncidentSeverity,
	IncidentSyncState,
} from "./types";

export const INCIDENT_DESCRIPTION_MAX_LENGTH = 2000;
export const INCIDENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const INCIDENT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Tolerated clock drift before an event time counts as "in the future" (matches the API). */
export const INCIDENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const INCIDENT_LIST_STALE_TIME_MS = 15_000;
/** How often due records are retried while online. */
export const INCIDENT_SYNC_INTERVAL_MS = 15_000;
export const INCIDENT_RETRY_BASE_DELAY_MS = 5_000;
export const INCIDENT_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

export const GEOLOCATION_TIMEOUT_MS = 10_000;
export const GEOLOCATION_MAX_AGE_MS = 60_000;

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
	injury: "Chấn thương",
	illness: "Ốm / mệt",
	lost_member: "Thành viên thất lạc",
	equipment_failure: "Hỏng thiết bị",
	weather_hazard: "Thời tiết nguy hiểm",
	route_obstruction: "Đường bị chặn",
	wildlife: "Động vật hoang dã",
	other: "Khác",
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
	low: "Thấp",
	medium: "Trung bình",
	high: "Cao",
	critical: "Nghiêm trọng",
};

export const incidentSeverityStyles: Record<IncidentSeverity, string> = {
	low: "bg-[#eef4ef] text-[#2d5a27]",
	medium: "bg-amber-50 text-amber-800",
	high: "bg-orange-100 text-orange-800",
	critical: "bg-rose-100 text-rose-800",
};

export const incidentSyncLabels: Record<IncidentSyncState, string> = {
	pending: "Chờ đồng bộ",
	syncing: "Đang đồng bộ",
	synced: "Đã đồng bộ",
	failed: "Đồng bộ thất bại",
};

export const incidentSyncStyles: Record<IncidentSyncState, string> = {
	pending: "bg-amber-50 text-amber-800 border-amber-200",
	syncing: "bg-sky-50 text-sky-800 border-sky-200",
	synced: "bg-[#eef4ef] text-[#2d5a27] border-[#cfe0d0]",
	failed: "bg-rose-50 text-rose-800 border-rose-200",
};

export const incidentMediaLabels: Record<IncidentMediaState, string | null> = {
	none: null,
	pending: "Ảnh chờ tải lên",
	uploaded: "Đã có ảnh",
	failed: "Tải ảnh thất bại",
};

export const incidentLocationNotes: Record<IncidentLocationStatus, string | null> = {
	fresh: null,
	stale: "Vị trí cũ hơn thời điểm sự cố",
	unavailable: "Không có vị trí",
};
