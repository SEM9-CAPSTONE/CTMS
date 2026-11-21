import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { VERIFIED_ZONE_REFRESH_MS, VERIFIED_ZONE_VIEW_DEBOUNCE_MS } from "../constants";
import { routeSafetyService } from "../services/route-safety.service";
import type { MapSafetyBounds } from "../types";

export function useVerifiedDangerZones(
	map: MapLibreMap | null,
	ready: boolean,
	fallback: boolean,
	fallbackBounds: MapSafetyBounds,
	userId: string
) {
	const [viewport, setViewport] = useState<MapSafetyBounds>();
	useEffect(() => {
		if (!map || !ready || fallback) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const read = () => {
			const bounds = map.getBounds();
			const west = bounds.getWest();
			const east = bounds.getEast();
			// A wrapped/whole-world viewport uses a bounded whole-world read rather than invalid longitudes.
			setViewport({
				west: west < -180 || east > 180 ? -180 : west,
				east: west < -180 || east > 180 ? 180 : east,
				south: Math.max(-90, bounds.getSouth()),
				north: Math.min(90, bounds.getNorth()),
			});
		};
		const moved = () => {
			clearTimeout(timer);
			timer = setTimeout(read, VERIFIED_ZONE_VIEW_DEBOUNCE_MS);
		};
		read();
		map.on("moveend", moved);
		return () => {
			clearTimeout(timer);
			map.off("moveend", moved);
		};
	}, [map, ready, fallback]);
	const bounds = fallback ? fallbackBounds : viewport;
	return useQuery({
		queryKey: queryKeys.routeSafety.verifiedZones(
			userId,
			bounds?.west ?? 0,
			bounds?.south ?? 0,
			bounds?.east ?? 0,
			bounds?.north ?? 0
		),
		queryFn: ({ signal }) => routeSafetyService.verifiedZones(bounds ?? fallbackBounds, signal),
		enabled: Boolean(userId && bounds && bounds.west < bounds.east && bounds.south < bounds.north),
		staleTime: 0,
		refetchInterval: VERIFIED_ZONE_REFRESH_MS,
		refetchOnWindowFocus: true,
		retry: false,
	});
}
