import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import {
	SAFETY_DEBOUNCE_MS,
	SAFETY_PROVIDERS,
	SAFETY_REFRESH_MS,
	SAFETY_STALE_MS,
} from "../constants";
import { routeSafetyService } from "../services/route-safety.service";
import { combineSafetyQueries } from "../utils/combine-safety-queries";

export function useRouteSafety(geometry: GeoJsonLineString, routeId?: string) {
	const geometryKey = JSON.stringify(geometry);
	const [stableKey, setStableKey] = useState(geometryKey);
	const hostId = getStoredAuthUser()?.id ?? "";
	useEffect(() => {
		const timer = window.setTimeout(() => setStableKey(geometryKey), SAFETY_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [geometryKey]);
	const valid =
		geometry.coordinates.length >= 2 &&
		new Set(geometry.coordinates.map((p) => p.join(","))).size >= 2;
	const pending = geometryKey !== stableKey;
	const query = useQueries({
		queries: SAFETY_PROVIDERS.map((source) => ({
			queryKey: queryKeys.routeSafety.analyze(hostId, routeId, stableKey, source),
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				routeSafetyService.analyze(
					JSON.parse(stableKey) as GeoJsonLineString,
					routeId,
					signal,
					source
				),
			enabled: Boolean(hostId) && valid && !pending,
			retry: false,
			staleTime: SAFETY_STALE_MS,
			refetchOnMount: "always" as const,
			refetchInterval: SAFETY_REFRESH_MS,
		})),
		combine: combineSafetyQueries,
	});
	// Never project an old response onto a newer line, even during the debounce window.
	return {
		...query,
		data: valid && !pending ? query.data : undefined,
		sources: valid && !pending ? query.sources : undefined,
		valid,
		pending,
	};
}
