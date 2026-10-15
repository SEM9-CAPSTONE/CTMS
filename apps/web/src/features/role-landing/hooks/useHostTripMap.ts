import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { trekkingRoutesService } from "../../trekking-routes/services/trekking-routes.service";

export function useHostTripMap(hostId: string, routeId?: string) {
	return useQuery({
		queryKey: queryKeys.trekking.hostTripMap(hostId, routeId ?? ""),
		enabled: Boolean(routeId),
		queryFn: async () => {
			if (!routeId) throw new Error("Missing route");
			const [routes, checkpoints] = await Promise.all([
				trekkingRoutesService.listMine(),
				trekkingRoutesService.listCheckpoints(routeId),
			]);
			const route = routes.find((item) => item.id === routeId);
			if (!route) throw new Error("Route not found");
			return { route, checkpoints };
		},
		retry: false,
		staleTime: 60_000,
	});
}
