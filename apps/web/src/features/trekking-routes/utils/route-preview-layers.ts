import type { Map as MapLibreMap } from "maplibre-gl";
import type { GeoJsonLineString } from "../types";
import { severityColors } from "./route-preview";
export function addRoutePreviewLayers(map: MapLibreMap, geometry: GeoJsonLineString) {
	map.addSource("route-preview-hazards", {
		type: "geojson",
		data: { type: "FeatureCollection", features: [] },
	});
	map.addLayer({
		id: "route-preview-hazards-fill",
		type: "fill",
		source: "route-preview-hazards",
		paint: {
			"fill-color": [
				"match",
				["get", "severity"],
				"low",
				severityColors.low,
				"medium",
				severityColors.medium,
				"high",
				severityColors.high,
				severityColors.medium,
			],
			"fill-opacity": ["case", ["==", ["get", "sourceGeometry"], "Point"], 0.44, 0.28],
		},
	});
	map.addLayer({
		id: "route-preview-hazards-outline",
		type: "line",
		source: "route-preview-hazards",
		paint: {
			"line-color": ["case", ["==", ["get", "sourceGeometry"], "Point"], "#172554", "#991b1b"],
			"line-width": ["case", ["==", ["get", "sourceGeometry"], "Point"], 3.5, 2],
		},
	});
	map.addSource("route-preview", {
		type: "geojson",
		data: { type: "Feature", properties: {}, geometry: geometry },
	});
	map.addLayer({
		id: "route-preview-line",
		type: "line",
		source: "route-preview",
		paint: { "line-color": "#ef6c35", "line-width": 5 },
	});
}
