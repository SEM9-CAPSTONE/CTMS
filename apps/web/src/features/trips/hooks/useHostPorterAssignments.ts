import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../services/trips.service";
import type { HostPorterAssignmentTrip } from "../types";

export function useHostPorterAssignments() {
	return useQuery<HostPorterAssignmentTrip[], unknown>({
		queryKey: queryKeys.trips.hostPorterAssignments,
		queryFn: () => tripsService.getHostPorterAssignments(),
		retry: false,
		staleTime: 15_000,
	});
}
