import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { performanceReportsService } from "../services/performance-reports.service";
import type { PerformanceReportData, PerformanceReportFilterParams } from "../types";

export function usePerformanceReport(params?: PerformanceReportFilterParams) {
	return useQuery<PerformanceReportData>({
		queryKey: queryKeys.performanceReports.report(params as Record<string, unknown>),
		queryFn: () => performanceReportsService.getReport(params),
		staleTime: 5 * 60 * 1000,
	});
}
