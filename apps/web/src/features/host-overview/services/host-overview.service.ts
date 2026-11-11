import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { hostOverviewSchema } from "../schema";
import type { HostOverview } from "../types";

export const hostOverviewService = {
	get: async (page: number, limit: number, signal?: AbortSignal): Promise<HostOverview> =>
		hostOverviewSchema.parse(
			await httpClient.get<unknown>(API_ENDPOINTS.HOST_OVERVIEW, { page, limit }, { signal })
		),
};
