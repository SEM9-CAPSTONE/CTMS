import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { HOST_ANALYTICS_STALE_TIME_MS } from "../constants";
import { hostAnalyticsService } from "../services/host-analytics.service";
import type { HostAnalyticsFilterParams } from "../types";

export function useHostAnalytics(actor: string, params: HostAnalyticsFilterParams) {
	const areaKey = params.areaCode ?? "all";
	return useQuery({
		queryKey: queryKeys.hostAnalytics.summary(actor, params.from, params.to, areaKey),
		queryFn: () => hostAnalyticsService.getAnalytics(params),
		enabled: Boolean(actor && params.from && params.to),
		staleTime: HOST_ANALYTICS_STALE_TIME_MS,
		retry: false,
	});
}
