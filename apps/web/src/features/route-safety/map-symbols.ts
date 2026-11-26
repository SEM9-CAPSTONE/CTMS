import type { GeoJsonPoint } from "../trekking-routes/types";
import type { SafetyFeature, SafetySeverity } from "./types";

export const SAFETY_COLORS: Record<SafetySeverity, string> = {
	LOW: "#a3a332",
	MEDIUM: "#ffcc00",
	HIGH: "#d53333",
	VERY_HIGH: "#e000d4",
	UNKNOWN: "#64748b",
};
export const WATER_COLOR = "#0284c7";
export const HAZARD_MARKER_COLOR = SAFETY_COLORS.MEDIUM;
export const WATER_SYMBOL_PATHS = {
	shape: "M12 1C10 6 4 11 4 16a8 8 0 0 0 16 0C20 11 14 6 12 1Z",
	mark: "M8 16a4 4 0 0 0 4 4",
};
export type SafetySymbolKind = "hazard" | "water";
export function featureMarkerPoint(feature: SafetyFeature): GeoJsonPoint | undefined {
	if (feature.geometry.type === "Point") return feature.geometry;
	if (feature.properties.sourceType === "ADMIN_VERIFIED")
		return feature.properties.labelPoint ?? undefined;
	return undefined;
}
/** Hazard markers show only the warning triangle. */
export const isBareSymbol = (feature: SafetyFeature) =>
	feature.properties.sourceType !== "RESOURCE";
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
