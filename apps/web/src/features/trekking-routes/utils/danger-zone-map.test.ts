import { describe, expect, it } from "vitest";
import type { RouteDangerZone } from "../types";
import {
	closePolygonRing,
	dangerZoneFeatureCollection,
	dangerZonePolygon,
} from "./danger-zone-map";
import { approximateLengthMeters } from "./route-import";

const base = {
	id: "zone-id",
	routeId: "route-id",
	description: "Hazard",
	severity: "high" as const,
	createdAt: "2026-09-04T00:00:00.000Z",
	updatedAt: "2026-09-04T00:00:00.000Z",
};

describe("danger-zone map utilities", () => {
	it("closes only a selection with three distinct vertices", () => {
		const vertices: Array<[number, number]> = [
			[108.45, 11.94],
			[108.46, 11.95],
			[108.47, 11.94],
		];
		expect(closePolygonRing(vertices)?.coordinates[0]).toEqual([...vertices, vertices[0]]);
		expect(closePolygonRing([vertices[0], vertices[0], vertices[1]])).toBeUndefined();
	});

	it("expands Point hazards to a geodesic Polygon and retains Polygon hazards", () => {
		const point: RouteDangerZone = {
			...base,
			geometry: { type: "Point", coordinates: [108.46, 11.94] },
			radiusMeters: 50,
		};
		const polygonGeometry = closePolygonRing([
			[108.45, 11.94],
			[108.46, 11.95],
			[108.47, 11.94],
		]);
		if (!polygonGeometry) throw new Error("Expected valid fixture polygon");
		const polygon: RouteDangerZone = {
			...base,
			id: "polygon-id",
			geometry: polygonGeometry,
			radiusMeters: null,
		};
		expect(dangerZonePolygon(point).type).toBe("Polygon");
		if (point.geometry.type !== "Point") throw new Error("Expected point geometry");
		expect(
			approximateLengthMeters([
				point.geometry.coordinates,
				dangerZonePolygon(point).coordinates[0][0],
			])
		).toBeCloseTo(5, 2);
		expect(point.radiusMeters).toBe(50);
		expect(dangerZonePolygon(polygon)).toBe(polygonGeometry);
		expect(dangerZoneFeatureCollection([point, polygon]).features).toHaveLength(2);
	});
});
