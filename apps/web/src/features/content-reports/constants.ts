import type { ReportType } from "./types";
export const REPORT_LIMIT = 1000;
export const REPORT_PAGE_SIZE = 10;
export const REPORT_LABELS: Record<ReportType, string> = {
	inaccurate_information: "Thông tin không chính xác",
	dangerous_content: "Nội dung nguy hiểm",
};
export const MY_REPORTS_PATH = "/host/content-reports";
export const reportTypeLabel = (code: string) =>
	Object.hasOwn(REPORT_LABELS, code) ? REPORT_LABELS[code as ReportType] : "Loại báo cáo khác";
export const reportDate = (date: string) =>
	`${new Date(date).toLocaleString("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})} ${new Date(date).toLocaleTimeString("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		hour: "2-digit",
		minute: "2-digit",
	})}`;
