import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import type { LiveSafetySource, SafetyProvider } from "./live-safety.types";

export const ROUTE_CONTEXT = {
	vndmsUrl: "https://vndms.gov.vn",
	vndmsPath: "/EventDisaster/Searching",
	overpassUrl: "https://overpass.private.coffee/api/interpreter",
	osmMapUrl: "https://api.openstreetmap.org/api/0.6/map.json",
	overpassTimeoutMs: 7000,
	waterHedgeDelayMs: 400,
	maxMapEnvelopeArea: 0.01,
	timeoutMs: 20000,
	maxRecords: 20000,
	maxWaterRecords: 1000,
	maxWaterEnvelopeDegrees: 1,
	metersPerDegree: 111000,
} as const;

export function sourceStatus(source: SafetyProvider): LiveSafetySource {
	return {
		source,
		status: "UNAVAILABLE",
		checkedAt: new Date().toISOString(),
		dataTime: null,
		validUntil: null,
	};
}

export function routeEnvelope(geometry: GeoLineString, meters: number): number[] {
	const xs = geometry.coordinates.map(([x]) => x);
	const ys = geometry.coordinates.map(([, y]) => y);
	const latitude = Math.max(...ys.map(Math.abs));
	const dy = meters / ROUTE_CONTEXT.metersPerDegree;
	const dx = dy / Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
	return [
		Math.max(-180, Math.min(...xs) - dx),
		Math.max(-90, Math.min(...ys) - dy),
		Math.min(180, Math.max(...xs) + dx),
		Math.min(90, Math.max(...ys) + dy),
	];
}

// VNDMS publishes local Vietnam timestamps without an offset.
export function vndmsTime(value: unknown): string | null {
	if (
		typeof value !== "string" ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value)
	)
		return null;
	const normalized = /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+07:00`;
	return Number.isFinite(Date.parse(normalized)) ? new Date(normalized).toISOString() : null;
}
