import { queryKeys } from "../../../core/api/queryKeys";
import { useAuthorizedRead } from "../../review-reputation/useAuthorizedRead";
import { tripsService } from "../services/trips.service";
import type { HostPorterAssignmentTrip } from "../types";

export function useHostPorterAssignments() {
	return useAuthorizedRead<HostPorterAssignmentTrip[]>(queryKeys.trips.hostPorterAssignments, () =>
		tripsService.getHostPorterAssignments()
	);
}
