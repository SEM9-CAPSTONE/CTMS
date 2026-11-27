import type { MapMouseEvent, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { GeoJsonLineString, Position } from "../types";
import { type RouteLineHit, findRouteLineHit } from "../utils/route-line-hit";
import { DRAWING_POINT_CLASS, drawingPointLabel } from "../utils/route-map";
import { useRouteMapSurface } from "./useRouteMapSurface";

function waypointPosition({ lng, lat }: { lng: number; lat: number }): Position {
	const longitude = lng < -180 || lng > 180 ? ((((lng + 180) % 360) + 360) % 360) - 180 : lng;
	return [Number(longitude.toFixed(6)), Number(lat.toFixed(6))];
}

export function useRouteGeometryMap(
	value: GeoJsonLineString,
	waypoints: Position[],
	disabled: boolean,
	onChange: (waypoints: Position[]) => void,
	onSelect: (index: number) => void,
	onInsert?: (hit: RouteLineHit) => void
) {
	const markersRef = useRef<Marker[]>([]);
	const onChangeRef = useRef(onChange);
	const onSelectRef = useRef(onSelect);
	const onInsertRef = useRef(onInsert);
	const valueRef = useRef(value);
	const waypointsRef = useRef(waypoints);
	const disabledRef = useRef(disabled);

	useEffect(() => {
		onChangeRef.current = onChange;
		onSelectRef.current = onSelect;
		onInsertRef.current = onInsert;
		valueRef.current = value;
		waypointsRef.current = waypoints;
		disabledRef.current = disabled;
	}, [disabled, onChange, onInsert, onSelect, value, waypoints]);

	const surface = useRouteMapSurface(
		(map) => {
			map.addSource("route", {
				type: "geojson",
				data: { type: "Feature", properties: {}, geometry: valueRef.current },
			});
			map.addLayer({
				id: "route-line",
				type: "line",
				source: "route",
				paint: { "line-color": "#ef6c35", "line-width": 5 },
			});
		},
		(event: MapMouseEvent) => {
			const target = event.originalEvent.target;
			if (
				target instanceof Element &&
				target.closest("[data-safety-ui], .maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl")
			)
				return;
			if (disabledRef.current) return;
			if (onInsertRef.current) {
				const hit = findRouteLineHit(
					valueRef.current.coordinates,
					event.point,
					(point) => event.target.project(point),
					10
				);
				if (hit) {
					onInsertRef.current(hit);
					return;
				}
			}
			onChangeRef.current([...waypointsRef.current, waypointPosition(event.lngLat)]);
		},
		value.coordinates[0]
	);
	const { map, mapReady } = surface;

	useEffect(() => {
		if (!map || !mapReady) return;
		const source = map.getSource("route") as { setData?: (data: object) => void } | undefined;
		source?.setData?.({ type: "Feature", properties: {}, geometry: value });
	}, [map, mapReady, value]);

	useEffect(() => {
		if (!map || !mapReady) return;
		let disposed = false;
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];
		void import("../../../core/maps/maplibre").then((maplibre) => {
			if (disposed) return;
			markersRef.current = waypoints.map((position, index) => {
				const element = document.createElement("button");
				element.type = "button";
				element.className = DRAWING_POINT_CLASS;
				element.style.zIndex = "10";
				element.ariaLabel = drawingPointLabel(index);
				element.onclick = (event) => {
					event.stopPropagation();
					onSelectRef.current(index);
				};
				const marker = new maplibre.Marker({ element, draggable: !disabled })
					.setLngLat(position)
					.addTo(map);
				marker.on("dragend", () => {
					if (disposed || disabledRef.current || waypointsRef.current !== waypoints) return;
					const next = [...waypointsRef.current];
					next[index] = waypointPosition(marker.getLngLat());
					// A drag is a proposal until all affected segments have been resolved.
					marker.setLngLat(waypoints[index]);
					onChangeRef.current(next);
				});
				return marker;
			});
		});
		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
		};
	}, [disabled, map, mapReady, waypoints]);

	return surface;
}
