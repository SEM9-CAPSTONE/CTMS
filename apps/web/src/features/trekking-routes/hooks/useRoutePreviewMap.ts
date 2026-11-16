import type { Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { GeoJsonLineString, RouteCheckpoint, RouteDangerZone } from "../types";
import { dangerZoneFeatureCollection, dangerZonePositions } from "../utils/danger-zone-map";
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
	fitDangerZones: RouteDangerZone[] = dangerZones
) {
	const geometryRef = useRef(geometry);
	const positionsRef = useRef(geometry.coordinates);
	const markersRef = useRef<Marker[]>([]);
	const previewPositions = useMemo(
		() => [
			...geometry.coordinates,
			...checkpoints.map((checkpoint) => checkpoint.location.coordinates),
			...dangerZonePositions(fitDangerZones),
		],
		[checkpoints, fitDangerZones, geometry.coordinates]
	);
	const persistedHazards = useMemo(() => {
		const collection = dangerZoneFeatureCollection(dangerZones);
		return {
			...collection,
			features: collection.features.map((feature, index) => ({
				...feature,
				properties: {
					...feature.properties,
					sourceGeometry: dangerZones[index]?.geometry.type ?? "Polygon",
				},
			})),
		};
	}, [dangerZones]);
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
	useDangerZoneMapDetails(
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

		void import("maplibre-gl").then(({ Marker: MapMarker }) => {
			if (disposed) return;
			markersRef.current = checkpoints.map((checkpoint, index) => {
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
		});

		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
		};
	}, [checkpoints, map, mapReady]);

	return {
		...surface,
		bounds,
		fitAll: () => {
			if (map) fitRoute(map, previewPositions);
		},
	};
}
