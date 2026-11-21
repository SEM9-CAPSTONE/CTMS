import type { StatusBadgeTone } from "../../shared/components";
import type {
	CorrectiveActionType,
	HazardSeverity,
	HotspotReviewTarget,
	HotspotStatus,
	HotspotStatusFilter,
} from "./types";

export const HOTSPOT_PAGE_SIZE = 10;

export const HOTSPOT_STATUS_LABELS: Record<HotspotStatus, string> = {
	DETECTED: "Đang xem xét",
	UNDER_REVIEW: "Đang xem xét",
	CONFIRMED: "Đã xác nhận",
	DISMISSED: "Đã bác bỏ",
};

export const HOTSPOT_STATUS_TONES: Record<HotspotStatus, StatusBadgeTone> = {
	DETECTED: "warning",
	UNDER_REVIEW: "warning",
	CONFIRMED: "success",
	DISMISSED: "neutral",
};

export const HOTSPOT_STATUS_FILTERS: Array<{ value: HotspotStatusFilter; label: string }> = [
	{ value: "ALL", label: "Tất cả" },
	{ value: "CONFIRMED", label: HOTSPOT_STATUS_LABELS.CONFIRMED },
	{ value: "UNDER_REVIEW", label: HOTSPOT_STATUS_LABELS.UNDER_REVIEW },
	{ value: "DISMISSED", label: HOTSPOT_STATUS_LABELS.DISMISSED },
];

export const CORRECTIVE_ACTION_LABELS: Record<CorrectiveActionType, string> = {
	ADD_HAZARD_AREA: "Thêm vùng nguy hiểm",
	UPDATE_HAZARD_AREA: "Sửa vùng nguy hiểm",
	UPDATE_CHECKPOINT_INSTRUCTIONS: "Cập nhật hướng dẫn an toàn tại điểm dừng",
	NO_DATA_CHANGE: "Không cần thay đổi dữ liệu",
	OTHER: "Biện pháp khác",
};

export const HAZARD_SEVERITY_OPTIONS: Array<{ value: HazardSeverity; label: string }> = [
	{ value: "high", label: "Cao" },
	{ value: "medium", label: "Trung bình" },
	{ value: "low", label: "Thấp" },
];

export const HOTSPOT_REVIEW_TOASTS: Record<HotspotReviewTarget, string> = {
	CONFIRMED: "Đã xác nhận điểm nóng.",
	DISMISSED: "Đã bác bỏ điểm nóng.",
};
