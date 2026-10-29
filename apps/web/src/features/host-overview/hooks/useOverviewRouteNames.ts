import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { trekkingRoutesService } from "../../trekking-routes/services/trekking-routes.service";
import { OVERVIEW_STALE_TIME_MS } from "../constants";
import type { HostOverview } from "../types";

/** Resolve display labels through the existing authorized API; never infer route names. */
export function useOverviewRouteNames(hostId: string, data: HostOverview): Map<string, string> {
	const names = new Map(data.routes.data?.items.map((route) => [route.id, route.name]));
	const missing = [...new Set(data.weather.data?.items.map((item) => item.routeId))].filter(
		(id) => !names.has(id)
	);
	const queries = useQueries({
		queries: missing.map((id) => ({
			queryKey: queryKeys.hostOverview.routeName(hostId, id),
			queryFn: async () => (await trekkingRoutesService.getMineById(id)).name,
			staleTime: OVERVIEW_STALE_TIME_MS,
			retry: false,
		})),
	});
	queries.forEach((query, index) => {
		if (typeof query.data === "string" && query.data.trim()) names.set(missing[index], query.data);
	});
	return names;
}
