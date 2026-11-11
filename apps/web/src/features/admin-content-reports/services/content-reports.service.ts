import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ContentReport, ReportQueue, ReportTransition } from "../types";

export const contentReportsService = {
	list: (page: number, limit: number): Promise<ReportQueue> =>
		httpClient.get<ReportQueue>(API_ENDPOINTS.CONTENT_REPORTS.LIST, { page, limit }),
	detail: (id: string): Promise<ContentReport> =>
		httpClient.get<ContentReport>(API_ENDPOINTS.CONTENT_REPORTS.DETAIL(id)),
	transition: (id: string, payload: ReportTransition): Promise<ContentReport> =>
		httpClient.patch<ContentReport>(API_ENDPOINTS.CONTENT_REPORTS.STATUS(id), payload),
};
