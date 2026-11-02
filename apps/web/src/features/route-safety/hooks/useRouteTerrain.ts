import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import { terrainService } from "../services/terrain.service";
import {
	TERRAIN_CACHE_MS,
	TERRAIN_DEBOUNCE_MS,
	TERRAIN_FAILURE_CACHE_MS,
	TERRAIN_MODEL_VERSION,
} from "../terrain-constants";
import { terrainAdvice } from "../utils/terrain-advice";

export function useRouteTerrain(geometry: GeoJsonLineString, duration: string) {
	const geometryKey = JSON.stringify(geometry);
	const [stableKey, setStableKey] = useState(geometryKey);
	const hostId = getStoredAuthUser()?.id ?? "";
	useEffect(() => {
		const timer = window.setTimeout(() => setStableKey(geometryKey), TERRAIN_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [geometryKey]);
	const pending = stableKey !== geometryKey;
	const valid = terrainAdvice(geometry, duration).valid;
	const query = useQuery({
		queryKey: queryKeys.routeSafety.terrain(hostId, stableKey, TERRAIN_MODEL_VERSION),
		queryFn: ({ signal }) =>
			terrainService.analyze(JSON.parse(stableKey) as GeoJsonLineString, signal),
		enabled: Boolean(hostId) && valid && !pending,
		staleTime: (entry) =>
			entry.state.data?.status === "READY" ? TERRAIN_CACHE_MS : TERRAIN_FAILURE_CACHE_MS,
		gcTime: TERRAIN_CACHE_MS,
		retry: false,
		refetchOnWindowFocus: false,
	});
	const data = !pending && valid ? query.data : undefined;
	return {
		...terrainAdvice(geometry, duration, data),
		data,
		loading: pending || query.isFetching,
		unavailable:
			!pending &&
			(query.isError ||
				data?.status === "UNAVAILABLE" ||
				data?.status === "NOT_CONFIGURED" ||
				!hostId),
		retry: () => query.refetch(),
	};
}
