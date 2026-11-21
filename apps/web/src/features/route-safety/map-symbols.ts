import type { GeoJsonPoint } from "../trekking-routes/types";
import type { SafetyFeature, SafetySeverity } from "./types";

export const SAFETY_COLORS: Record<SafetySeverity, string> = {
	LOW: "#a3a332",
	MEDIUM: "#eab308",
	HIGH: "#f97316",
	VERY_HIGH: "#dc2626",
	UNKNOWN: "#64748b",
};
export const WATER_COLOR = "#0284c7";
export const SYMBOL_PATHS = {
	hazard: { shape: "M12 2 23 22H1Z", mark: "M12 8v6m0 4v.1" },
	water: {
		shape: "M12 1C10 6 4 11 4 16a8 8 0 0 0 16 0C20 11 14 6 12 1Z",
		mark: "M8 16a4 4 0 0 0 4 4",
	},
};
export type SafetySymbolKind = keyof typeof SYMBOL_PATHS;
export function featureMarkerPoint(feature: SafetyFeature): GeoJsonPoint | undefined {
	if (feature.geometry.type === "Point") return feature.geometry;
	if (feature.properties.sourceType === "ADMIN_VERIFIED")
		return feature.properties.labelPoint ?? undefined;
	return undefined;
}
/** Verified danger zones show only the warning sign: no badge frame, outline or radius ring. */
export const isBareSymbol = (feature: SafetyFeature) =>
	feature.properties.sourceType === "ADMIN_VERIFIED";
const FRAMED_MARKER = "rounded-full border-2 border-white bg-white/95 p-1 shadow-sm hover:bg-white";
export const markerFrameClass = (feature: SafetyFeature) =>
	isBareSymbol(feature) ? "bg-transparent" : FRAMED_MARKER;
export const featureColor = (feature: SafetyFeature) =>
	feature.properties.sourceType === "RESOURCE"
		? WATER_COLOR
		: SAFETY_COLORS[feature.properties.severity];
export const isMutedFeature = (feature: SafetyFeature) =>
	feature.properties.sourceType !== "RESOURCE" && feature.properties.lifecycleStatus !== "ACTIVE";
export const isDisplayableFeature = (feature: SafetyFeature) =>
	feature.properties.sourceType !== "RESOURCE" ||
	(["Point", "LineString"].includes(feature.geometry.type) &&
		!["water_water", "water_surface", "water_lake", "water_reservoir"].includes(
			feature.properties.hazardType
		));

/** The DOM marker and React legend share these paths; no remote icon or font requests. */
export function createSafetySymbol(
	kind: SafetySymbolKind,
	color: string,
	outlined = true
): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", "28");
	svg.setAttribute("height", "28");
	svg.setAttribute("aria-hidden", "true");
	for (const [key, path] of Object.entries(SYMBOL_PATHS[kind])) {
		const element = document.createElementNS(svg.namespaceURI, "path");
		element.setAttribute("d", path);
		element.setAttribute("fill", key === "shape" ? color : "none");
		element.setAttribute("stroke", key === "shape" && !outlined ? "none" : "white");
		element.setAttribute("stroke-width", key === "shape" ? "1.5" : "2.5");
		element.setAttribute("stroke-linecap", "round");
		svg.append(element);
	}
	return svg;
}
