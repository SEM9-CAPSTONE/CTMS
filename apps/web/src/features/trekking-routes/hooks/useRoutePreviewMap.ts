import type { Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { GeoJsonLineString, Position, RouteCheckpoint, RouteDangerZone } from "../types";
import { dangerZoneFeatureCollection, dangerZonePositions } from "../utils/danger-zone-map";
import { waypointMarker } from "../utils/route-map";
import {
	checkpointDescription,
	checkpointMarkerColor,
	checkpointMarkerLabel,
	fitRoute,
	previewBounds,
} from "../utils/route-preview";
import { addRoutePreviewLayers } from "../utils/route-preview-layers";
import { useDangerZoneMapDetails } from "./useDangerZoneMapDetails";
import { useRouteMapSurface } from "./useRouteMapSurface";

export function useRoutePreviewMap(
	geometry: GeoJsonLineString,
	checkpoints: RouteCheckpoint[],
	dangerZones: RouteDangerZone[],
	fitDangerZones: RouteDangerZone[] = dangerZones,
	waypoints?: Position[]
) {
	const geometryRef = useRef(geometry);
	const positionsRef = useRef(geometry.coordinates);
	const markersRef = useRef<Marker[]>([]);
	const previewPositions = useMemo(
		() => [
			...geometry.coordinates,
			...(waypoints ?? []),
			...checkpoints.map((checkpoint) => checkpoint.location.coordinates),
			...dangerZonePositions(fitDangerZones),
		],
		[checkpoints, fitDangerZones, geometry.coordinates, waypoints]
	);
	const persistedHazards = useMemo(() => dangerZoneFeatureCollection(dangerZones), [dangerZones]);
	const bounds = useMemo(() => previewBounds(previewPositions), [previewPositions]);
	useEffect(() => {
		geometryRef.current = geometry;
		positionsRef.current = previewPositions;
	}, [geometry, previewPositions]);
	const surface = useRouteMapSurface(
		(map) => {
			addRoutePreviewLayers(map, geometryRef.current);
			fitRoute(map, positionsRef.current);
		},
		undefined,
		geometry.coordinates[0]
	);
	const { map, mapReady } = surface;
	const dangerZoneDetails = useDangerZoneMapDetails(
		map,
		mapReady && !surface.fallback,
		dangerZones,
		"route-preview-hazards-fill"
	);
	useEffect(() => {
		if (!map || !mapReady) return;
		const source = map.getSource("route-preview") as
			| { setData?: (data: object) => void }
			| undefined;
		source?.setData?.({ type: "Feature", properties: {}, geometry });
		const hazardsSource = map.getSource("route-preview-hazards") as
			| { setData?: (data: object) => void }
			| undefined;
		hazardsSource?.setData?.(persistedHazards);
		fitRoute(map, previewPositions);
	}, [geometry, map, mapReady, persistedHazards, previewPositions]);

	useEffect(() => {
		if (!map || !mapReady) return;
		let disposed = false;
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];

		void import("../../../core/maps/maplibre").then(({ Marker: MapMarker }) => {
			if (disposed) return;
			const drawingMarkers = (waypoints ?? []).map((point, index, points) => {
				const element = document.createElement("div");
				const { label, symbol, color } = waypointMarker(index, points.length);
				element.className = `pointer-events-none flex size-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow ${color}`;
				element.textContent = symbol;
				element.setAttribute("role", "img");
				element.setAttribute("aria-label", label);
				element.title = label;
				return new MapMarker({ element }).setLngLat(point).addTo(map);
			});
			const checkpointMarkers = checkpoints.map((checkpoint, index) => {
				const element = document.createElement("div");
				const shelter = checkpoint.type === "emergency_shelter";
				element.className = shelter
					? "flex size-7 items-center justify-center rounded-md border-2 border-white text-xs font-extrabold text-white shadow"
					: "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow";
				element.style.backgroundColor = checkpointMarkerColor(checkpoint.type);
				element.textContent = checkpointMarkerLabel(checkpoint, index);
				element.dataset.checkpointType = checkpoint.type;
				const description = checkpointDescription(checkpoint);
				element.setAttribute("aria-label", description);
				element.setAttribute("title", description);
				return new MapMarker({ element }).setLngLat(checkpoint.location.coordinates).addTo(map);
			});
			markersRef.current = [...drawingMarkers, ...checkpointMarkers];
		});

		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
		};
	}, [checkpoints, map, mapReady, waypoints]);

	return {
		...surface,
		dangerZoneDetails,
		bounds,
		fitAll: () => {
			if (map) fitRoute(map, previewPositions);
		},
	};
}
