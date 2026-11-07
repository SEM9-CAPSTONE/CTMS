import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import {
	type MemberLocationsService,
	memberLocationsService,
} from "../services/member-locations.service";

/** Same approved cadence as the CTMS-063 progress card. */
export const MEMBER_LOCATIONS_REFRESH_MS = 60_000;

export function useMemberLocations(
	tripId: string,
	service: MemberLocationsService = memberLocationsService
) {
	return useQuery({
		queryKey: queryKeys.trips.memberLocations(tripId),
		queryFn: () => service.get(tripId),
		refetchInterval: MEMBER_LOCATIONS_REFRESH_MS,
		retry: false,
	});
}
