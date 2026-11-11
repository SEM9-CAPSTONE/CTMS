import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { sosHandlingService } from "../services/sos-handling.service";
import type { HostSosFilterParams, HostSosListResponse } from "../types";

export function useHostSos(params?: HostSosFilterParams, options?: { enabled?: boolean }) {
	return useQuery<HostSosListResponse, Error>({
		queryKey: queryKeys.sos.hostList(params as Record<string, unknown> | undefined),
		queryFn: () => sosHandlingService.listForHost(params),
		staleTime: 10_000,
		refetchInterval: 15_000,
		enabled: options?.enabled ?? true,
	});
}
