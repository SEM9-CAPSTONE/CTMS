import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { GeoArea, RevenueAnalyticsData, RevenueAnalyticsFilterParams } from "../types";

export const revenueAnalyticsService = {
	getReport: async (params: RevenueAnalyticsFilterParams = {}): Promise<RevenueAnalyticsData> => {
		const searchParams = new URLSearchParams();
		if (params.from && params.to) {
			searchParams.set("from", params.from);
			searchParams.set("to", params.to);
		} else if (params.period) {
			searchParams.set("period", params.period);
		}
		if (params.granularity) searchParams.set("granularity", params.granularity);
		if (params.areaCode) searchParams.set("areaCode", params.areaCode);
		if (params.hostId) searchParams.set("hostId", params.hostId);

		const query = searchParams.toString();
		return httpClient.get<RevenueAnalyticsData>(
			query ? `${API_ENDPOINTS.REPORTS.REVENUE}?${query}` : API_ENDPOINTS.REPORTS.REVENUE
		);
	},

	listAreas: (): Promise<GeoArea[]> => httpClient.get<GeoArea[]>(API_ENDPOINTS.GEO_AREAS),
};
