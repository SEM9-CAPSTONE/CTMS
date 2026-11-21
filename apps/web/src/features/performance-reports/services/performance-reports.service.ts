import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { PerformanceReportData, PerformanceReportFilterParams } from "../types";

export const performanceReportsService = {
	getReport: async (params?: PerformanceReportFilterParams): Promise<PerformanceReportData> => {
		const searchParams = new URLSearchParams();
		if (params?.period) {
			searchParams.set("period", params.period);
		}
		if (params?.from) {
			searchParams.set("from", params.from);
		}
		if (params?.to) {
			searchParams.set("to", params.to);
		}
		if (params?.province?.trim()) {
			searchParams.set("province", params.province.trim());
		}
		if (params?.city?.trim()) {
			searchParams.set("city", params.city.trim());
		}
		if (params?.routeId) {
			searchParams.set("routeId", params.routeId);
		}
		if (params?.tripId) {
			searchParams.set("tripId", params.tripId);
		}

		const queryString = searchParams.toString();
		const endpoint = queryString
			? `${API_ENDPOINTS.REPORTS.PERFORMANCE}?${queryString}`
			: API_ENDPOINTS.REPORTS.PERFORMANCE;

		return httpClient.get<PerformanceReportData>(endpoint);
	},
};
