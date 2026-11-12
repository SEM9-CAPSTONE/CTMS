import { ReportPeriodPreset } from "./types";

export const REPORT_PERIOD_OPTIONS = [
	{ key: ReportPeriodPreset.DAYS_7, label: "7 ngày qua" },
	{ key: ReportPeriodPreset.DAYS_30, label: "30 ngày qua" },
	{ key: ReportPeriodPreset.DAYS_90, label: "90 ngày qua" },
	{ key: ReportPeriodPreset.THIS_MONTH, label: "Tháng này" },
	{ key: ReportPeriodPreset.LAST_MONTH, label: "Tháng trước" },
	{ key: ReportPeriodPreset.MONTHS_12, label: "12 tháng qua" },
	{ key: ReportPeriodPreset.ALL_TIME, label: "Tất cả" },
] as const;

export const DEFAULT_REPORT_PERIOD = ReportPeriodPreset.DAYS_30;

export const TRIP_STATUS_LABELS: Record<string, string> = {
	draft: "Bản nháp",
	pending_approval: "Chờ duyệt",
	published: "Đang mở đặt",
	ongoing: "Đang diễn ra",
	completed: "Đã hoàn thành",
	cancelled: "Đã hủy",
	rejected: "Bị từ chối",
};
