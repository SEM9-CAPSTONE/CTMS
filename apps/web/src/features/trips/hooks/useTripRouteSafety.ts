import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { trekkingRoutesService } from "../../trekking-routes/services/trekking-routes.service";

export function useTripRouteSafety(routeId: string | undefined) {
	const hostId = getStoredAuthUser()?.id ?? "";
	return useQuery({
		queryKey: queryKeys.trekking.hostTripMap(hostId, routeId ?? ""),
		enabled: Boolean(routeId && hostId && localStorage.getItem("accessToken")),
		queryFn: () => trekkingRoutesService.getRouteSafety(routeId ?? ""),
	});
}
