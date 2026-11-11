import { SEVERITY_ORDER } from "../constants";
import type { SafetyFeature } from "../types";

export function uniqueWarningAreas(features: SafetyFeature[]): SafetyFeature[] {
	const areas = new Map<string, SafetyFeature>();
	for (const feature of features) {
		if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;
		const key =
			feature.properties.geometryRole === "administrative_warning_area"
				? JSON.stringify([
						feature.properties.sourceType,
						feature.properties.source,
						feature.geometry,
					])
				: feature.id;
		const previous = areas.get(key);
		if (
			!previous ||
			SEVERITY_ORDER[feature.properties.severity] > SEVERITY_ORDER[previous.properties.severity]
		) {
			areas.set(key, feature);
		}
	}
	return [...areas.values()];
}
