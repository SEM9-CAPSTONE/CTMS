import type { ExternalSafetyInput, SafetyGeometry } from "./route-safety.types";

const position = (v: unknown): v is [number, number] =>
	Array.isArray(v) &&
	v.length === 2 &&
	typeof v[0] === "number" &&
	Number.isFinite(v[0]) &&
	Math.abs(v[0]) <= 180 &&
	typeof v[1] === "number" &&
	Number.isFinite(v[1]) &&
	Math.abs(v[1]) <= 90;
const line = (v: unknown): boolean =>
	Array.isArray(v) && v.length >= 2 && v.length <= 10000 && v.every(position);
const ring = (v: unknown): boolean =>
	Array.isArray(v) &&
	v.length >= 4 &&
	line(v) &&
	JSON.stringify(v[0]) === JSON.stringify(v[v.length - 1]);
const polygon = (v: unknown): boolean =>
	Array.isArray(v) && v.length > 0 && v.length <= 1000 && v.every(ring);

export function isSafetyGeometry(value: unknown): value is SafetyGeometry {
	if (value && typeof value === "object" && "crs" in value) return false;
	if (!value || typeof value !== "object" || !("type" in value) || !("coordinates" in value))
		return false;
	switch (value.type) {
		case "Point":
			return position(value.coordinates);
		case "LineString":
			return line(value.coordinates);
		case "Polygon":
			return polygon(value.coordinates);
		case "MultiPolygon":
			return (
				Array.isArray(value.coordinates) &&
				value.coordinates.length > 0 &&
				value.coordinates.length <= 1000 &&
				value.coordinates.every(polygon)
			);
		default:
			return false;
	}
}

export function parseSafetyInput(value: unknown): ExternalSafetyInput | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = { ...value } as Record<string, unknown>;
	for (const [field, max] of [
		["externalId", 200],
		["sourceReference", 1000],
		["hazardType", 100],
		["geometryRole", 100],
		["description", 2000],
	] as const) {
		if (typeof v[field] !== "string" || !v[field].trim() || v[field].length > max) return null;
	}
	if (
		!["OFFICIAL_CURRENT", "BASE_HISTORICAL", "RESOURCE"].includes(String(v.sourceType)) ||
		!["LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNKNOWN"].includes(String(v.severity)) ||
		!["ACTIVE", "RESOLVED"].includes(String(v.lifecycleStatus)) ||
		!["SOURCE_PROVIDED", "UNVERIFIED", "VERIFIED"].includes(String(v.verificationStatus)) ||
		!isSafetyGeometry(v.geometry)
	)
		return null;
	for (const field of ["observedAt", "issuedAt", "validFrom", "validUntil"] as const) {
		if (v[field] == null) v[field] = null;
		else if (
			typeof v[field] !== "string" ||
			!/(Z|[+-]\d{2}:\d{2})$/.test(v[field]) ||
			!Number.isFinite(Date.parse(v[field]))
		)
			return null;
	}
	if (
		v.validFrom &&
		v.validUntil &&
		Date.parse(String(v.validFrom)) >= Date.parse(String(v.validUntil))
	)
		return null;
	if (v.accuracyMeters == null) v.accuracyMeters = null;
	else if (
		typeof v.accuracyMeters !== "number" ||
		!Number.isFinite(v.accuracyMeters) ||
		v.accuracyMeters < 0
	)
		return null;
	return v as unknown as ExternalSafetyInput;
}
