import type { StatusBadgeTone } from "../../shared/components";
import type { CorrectiveActionType, HazardSeverity, HotspotStatus } from "./types";

export const HOTSPOT_PAGE_SIZE = 10;

export const HOTSPOT_STATUS_LABELS: Record<HotspotStatus, string> = {
	DETECTED: "Mới phát hiện",
	UNDER_REVIEW: "Đang xem xét",
	CONFIRMED: "Đã xác nhận",
	DISMISSED: "Đã bác bỏ",
};

export const HOTSPOT_STATUS_TONES: Record<HotspotStatus, StatusBadgeTone> = {
	DETECTED: "info",
	UNDER_REVIEW: "warning",
	CONFIRMED: "success",
	DISMISSED: "neutral",
};

export const HOTSPOT_STATUS_FILTERS: Array<{ value: HotspotStatus; label: string }> = [
	{ value: "CONFIRMED", label: HOTSPOT_STATUS_LABELS.CONFIRMED },
	{ value: "UNDER_REVIEW", label: HOTSPOT_STATUS_LABELS.UNDER_REVIEW },
	{ value: "DETECTED", label: HOTSPOT_STATUS_LABELS.DETECTED },
	{ value: "DISMISSED", label: HOTSPOT_STATUS_LABELS.DISMISSED },
];

export const CORRECTIVE_ACTION_LABELS: Record<CorrectiveActionType, string> = {
	ADD_HAZARD_AREA: "Thêm vùng nguy hiểm",
	UPDATE_HAZARD_AREA: "Sửa vùng nguy hiểm",
	UPDATE_CHECKPOINT_INSTRUCTIONS: "Cập nhật hướng dẫn an toàn tại điểm dừng",
	NO_DATA_CHANGE: "Không cần thay đổi dữ liệu",
	OTHER: "Biện pháp khác",
};

export const CORRECTIVE_ACTION_OPTIONS = (
	Object.keys(CORRECTIVE_ACTION_LABELS) as CorrectiveActionType[]
).map((value) => ({ value, label: CORRECTIVE_ACTION_LABELS[value] }));

export const HAZARD_SEVERITY_OPTIONS: Array<{ value: HazardSeverity; label: string }> = [
	{ value: "high", label: "Cao" },
	{ value: "medium", label: "Trung bình" },
	{ value: "low", label: "Thấp" },
];
