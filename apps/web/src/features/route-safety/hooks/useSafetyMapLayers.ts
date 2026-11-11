import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";
import { EMPTY_SAFETY_COLLECTION, SAFETY_SOURCE_ID } from "../constants";
import { SAFETY_COLORS, WATER_COLOR, isDisplayableFeature } from "../map-symbols";
import type { SafetyCollection } from "../types";
import { useSafetyMapSymbols } from "./useSafetyMapSymbols";

export function setSafetyMapData(map: MapLibreMap, data: SafetyCollection) {
	const visibleData = { ...data, features: data.features.filter(isDisplayableFeature) };
	let source = map.getSource(SAFETY_SOURCE_ID) as GeoJSONSource | undefined;
	if (!source) {
		map.addSource(SAFETY_SOURCE_ID, { type: "geojson", data: visibleData });
		const color: ExpressionSpecification = [
			"case",
			["==", ["get", "sourceType"], "RESOURCE"],
			WATER_COLOR,
			[
				"match",
				["get", "severity"],
				"VERY_HIGH",
				SAFETY_COLORS.VERY_HIGH,
				"HIGH",
				SAFETY_COLORS.HIGH,
				"MEDIUM",
				SAFETY_COLORS.MEDIUM,
				"LOW",
				SAFETY_COLORS.LOW,
				SAFETY_COLORS.UNKNOWN,
			],
		];
		map.addLayer({
			id: `${SAFETY_SOURCE_ID}-fill`,
			type: "fill",
			source: SAFETY_SOURCE_ID,
			filter: ["==", ["geometry-type"], "Polygon"],
			paint: {
				"fill-color": color,
				"fill-opacity": [
					"case",
					["==", ["get", "sourceType"], "RESOURCE"],
					0.25,
					["==", ["get", "lifecycleStatus"], "ACTIVE"],
					0.2,
					0.06,
				],
			},
		});
		map.addLayer({
			id: `${SAFETY_SOURCE_ID}-line`,
			type: "line",
			source: SAFETY_SOURCE_ID,
			filter: ["!=", ["geometry-type"], "Point"],
			paint: {
				"line-color": color,
				"line-width": 3,
				"line-opacity": [
					"case",
					["==", ["get", "sourceType"], "RESOURCE"],
					1,
					["==", ["get", "lifecycleStatus"], "ACTIVE"],
					1,
					0.35,
				],
			},
		});
		source = map.getSource(SAFETY_SOURCE_ID) as GeoJSONSource | undefined;
	}
	source?.setData(visibleData);
}

export function useSafetyMapLayers(
	map: MapLibreMap | null,
	ready: boolean,
	data?: SafetyCollection
) {
	useSafetyMapSymbols(map, ready, data);
	useEffect(() => {
		if (map && ready) setSafetyMapData(map, data ?? EMPTY_SAFETY_COLLECTION);
	}, [map, ready, data]);
}
