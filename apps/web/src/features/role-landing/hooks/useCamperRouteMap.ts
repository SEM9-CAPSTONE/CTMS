import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../../trips/services/trips.service";
const ROUTE_MAP_STALE_TIME = 30_000;
export function useCamperRouteMap(userId: string, tripId?: string) {
	return useQuery({
		queryKey: queryKeys.trips.bookedRouteMap(userId, tripId ?? ""),
		enabled: Boolean(userId && tripId),
		queryFn: () => tripsService.getBookedRouteMap(tripId ?? ""),
		staleTime: ROUTE_MAP_STALE_TIME,
		retry: false,
	});
}
