import { API_ENDPOINTS, httpClient } from "../../core/api";
import type { DemandPeriod, DemandReport, DemandStatus } from "./types";
export const demandService = {
	periods: (signal?: AbortSignal) =>
		httpClient.get<{ periods: DemandPeriod[] }>(API_ENDPOINTS.DEMAND_INSIGHTS.PERIODS, undefined, {
			signal,
			cache: "no-store",
		}),
	report: (month: string, signal?: AbortSignal) =>
		httpClient.get<DemandReport>(API_ENDPOINTS.DEMAND_INSIGHTS.REPORT(month), undefined, {
			signal,
			cache: "no-store",
		}),
	create: (month: string) =>
		httpClient.post<{ version: string; month: string; status: DemandStatus; reused: boolean }>(
			API_ENDPOINTS.DEMAND_INSIGHTS.REPORT(month),
			{}
		),
};
