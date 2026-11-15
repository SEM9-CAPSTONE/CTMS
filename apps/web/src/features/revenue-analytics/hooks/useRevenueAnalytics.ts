import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { revenueAnalyticsService } from "../services/revenue-analytics.service";
import type { GeoArea, RevenueAnalyticsData, RevenueAnalyticsFilterParams } from "../types";

export function useRevenueAnalytics(params: RevenueAnalyticsFilterParams) {
	return useQuery<RevenueAnalyticsData>({
		queryKey: queryKeys.revenueAnalytics.report(params as Record<string, unknown>),
		queryFn: () => revenueAnalyticsService.getReport(params),
		staleTime: 60 * 1000,
		placeholderData: keepPreviousData,
	});
}

export function useGeoAreas() {
	return useQuery<GeoArea[]>({
		queryKey: queryKeys.geoAreas.all,
		queryFn: () => revenueAnalyticsService.listAreas(),
		staleTime: 30 * 60 * 1000,
	});
}
