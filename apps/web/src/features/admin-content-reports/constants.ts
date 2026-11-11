import { ReportStatus } from "./types";

export const REPORT_PAGE_LIMIT = 20;
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
	[ReportStatus.PENDING]: "Chờ xử lý",
	[ReportStatus.REVIEWING]: "Đang xem xét",
	[ReportStatus.ACTIONED]: "Đã xử lý",
	[ReportStatus.REJECTED]: "Đã từ chối",
};
export const REPORT_ACTIONS = [
	{ status: ReportStatus.REVIEWING, label: "Chuyển sang xem xét" },
	{ status: ReportStatus.ACTIONED, label: "Đánh dấu đã xử lý" },
	{ status: ReportStatus.REJECTED, label: "Từ chối báo cáo" },
] as const;

export function reportActions(status: ReportStatus) {
	if (status === ReportStatus.PENDING) return REPORT_ACTIONS;
	if (status === ReportStatus.REVIEWING)
		return REPORT_ACTIONS.filter((action) => action.status !== ReportStatus.REVIEWING);
	return [];
}
