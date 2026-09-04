import type { GeoJsonPoint, GeoJsonPolygon, Position, RouteDangerZone } from "../types";
import { geodesicCircle } from "./checkpoint-map";

export function closePolygonRing(vertices: Position[]): GeoJsonPolygon | undefined {
	const distinct = new Set(vertices.map(([longitude, latitude]) => `${longitude},${latitude}`));
	if (distinct.size < 3) return undefined;
	const first = vertices[0];
	if (!first) return undefined;
	return { type: "Polygon", coordinates: [[...vertices, first]] };
}

export function dangerZonePolygon(zone: RouteDangerZone): GeoJsonPolygon {
	if (zone.geometry.type === "Polygon") return zone.geometry;
	return geodesicCircle(zone.geometry, zone.radiusMeters ?? 0).geometry;
}

export function pointHazardPolygon(point: GeoJsonPoint, radiusMeters: number): GeoJsonPolygon {
	return geodesicCircle(point, radiusMeters).geometry;
}

export function dangerZonePositions(zones: RouteDangerZone[]): Position[] {
	return zones.flatMap((zone) =>
		zone.geometry.type === "Point" ? [zone.geometry.coordinates] : zone.geometry.coordinates.flat()
	);
}

export function dangerZoneFeatureCollection(zones: RouteDangerZone[]) {
	return {
		type: "FeatureCollection" as const,
		features: zones.map((zone) => ({
			type: "Feature" as const,
			properties: { id: zone.id, severity: zone.severity, description: zone.description },
			geometry: dangerZonePolygon(zone),
		})),
	};
}
