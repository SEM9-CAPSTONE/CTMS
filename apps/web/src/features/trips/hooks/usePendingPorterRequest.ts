import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PorterRequest } from "../types";

export function usePendingPorterRequest(tripId: string, porterId: string) {
	return useQuery<PorterRequest | null, unknown>({
		queryKey: queryKeys.trips.pendingPorterRequest(tripId, porterId),
		queryFn: () => tripsService.getPendingPorterRequest(tripId, porterId),
		enabled: tripId.length > 0 && porterId.length > 0,
		retry: false,
		staleTime: 15_000,
	});
}
