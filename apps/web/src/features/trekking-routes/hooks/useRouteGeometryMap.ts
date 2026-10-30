import type { MapMouseEvent, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { GeoJsonLineString, Position } from "../types";
import { addVertex } from "../utils/route-geometry";
import { useRouteMapSurface } from "./useRouteMapSurface";

export function useRouteGeometryMap(
	value: GeoJsonLineString,
	disabled: boolean,
	onChange: (value: GeoJsonLineString) => void,
	onSelect: (index: number) => void
) {
	const markersRef = useRef<Marker[]>([]);
	const onChangeRef = useRef(onChange);
	const onSelectRef = useRef(onSelect);
	const valueRef = useRef(value);
	const disabledRef = useRef(disabled);

	useEffect(() => {
		onChangeRef.current = onChange;
		onSelectRef.current = onSelect;
		valueRef.current = value;
		disabledRef.current = disabled;
	}, [disabled, onChange, onSelect, value]);

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
				target.closest("[data-safety-ui], .maplibregl-popup, .maplibregl-ctrl")
			)
				return;
			if (!disabledRef.current)
				onChangeRef.current(
					addVertex(valueRef.current, [
						Number(event.lngLat.lng.toFixed(6)),
						Number(event.lngLat.lat.toFixed(6)),
					])
				);
		},
		value.coordinates[0]
	);
	const { map, mapReady } = surface;

	useEffect(() => {
		if (!map || !mapReady) return;
		let disposed = false;
		const source = map.getSource("route") as { setData?: (data: object) => void } | undefined;
		source?.setData?.({ type: "Feature", properties: {}, geometry: value });
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];
		void import("maplibre-gl").then((maplibre) => {
			if (disposed) return;
			markersRef.current = value.coordinates.map((position, index) => {
				const element = document.createElement("button");
				element.type = "button";
				element.className = "size-5 rounded-full border-2 border-white bg-[#164027] shadow";
				element.style.zIndex = "10";
				element.ariaLabel = `Đỉnh ${index + 1}`;
				element.onclick = (event) => {
					event.stopPropagation();
					onSelectRef.current(index);
				};
				const marker = new maplibre.Marker({ element, draggable: !disabled })
					.setLngLat(position)
					.addTo(map);
				marker.on("dragend", () => {
					const next = [...valueRef.current.coordinates] as Position[];
					const point = marker.getLngLat();
					next[index] = [Number(point.lng.toFixed(6)), Number(point.lat.toFixed(6))];
					onChangeRef.current({ type: "LineString", coordinates: next });
				});
				return marker;
			});
		});
		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
		};
	}, [disabled, map, mapReady, value]);

	return surface;
}
