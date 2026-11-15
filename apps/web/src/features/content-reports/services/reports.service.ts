import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { REPORT_PAGE_SIZE } from "../constants";
import type { OwnReport, OwnReportPage, ReportInput } from "../types";
export const reportsService = {
	list: (page: number, signal?: AbortSignal) =>
		httpClient.get<OwnReportPage>(
			API_ENDPOINTS.MY_CONTENT_REPORTS.LIST,
			{ page, limit: REPORT_PAGE_SIZE },
			{ signal }
		),
	detail: (id: string, signal?: AbortSignal) =>
		httpClient.get<OwnReport>(API_ENDPOINTS.MY_CONTENT_REPORTS.DETAIL(id), undefined, { signal }),
	create: (input: ReportInput) =>
		httpClient.post<OwnReport>(API_ENDPOINTS.MY_CONTENT_REPORTS.LIST, input),
};
