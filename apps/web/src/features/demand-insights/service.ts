import { API_ENDPOINTS, httpClient } from "../../core/api";
import type {
	CreatePlanningResponse,
	DemandPeriod,
	DemandPlanningReport,
	DemandReport,
	DemandStatus,
} from "./types";
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
	planning: (month: string, signal?: AbortSignal) =>
		httpClient.get<DemandPlanningReport>(API_ENDPOINTS.DEMAND_INSIGHTS.PLANNING(month), undefined, {
			signal,
			cache: "no-store",
		}),
	createPlanning: (month: string) =>
		httpClient.post<CreatePlanningResponse>(API_ENDPOINTS.DEMAND_INSIGHTS.PLANNING(month), {}),
};
