import { describe, expect, it } from "vitest";
import { closePolygonRing } from "../utils/danger-zone-map";
import {
	createRouteDangerZoneFormSchema,
	toCreateRouteDangerZoneInput,
} from "./create-route-danger-zone.schema";

const point = {
	geometry: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	radiusMeters: "25.5",
	description: "  Loose rock after rain  ",
	severity: "high" as const,
};

const polygon = closePolygonRing([
	[108.45, 11.94],
	[108.46, 11.95],
	[108.47, 11.94],
]);

describe("createRouteDangerZoneFormSchema", () => {
	it("accepts a Point and creates the exact radius payload", () => {
		const parsed = createRouteDangerZoneFormSchema.parse(point);
		expect(toCreateRouteDangerZoneInput(parsed)).toEqual({
			...point,
			radiusMeters: 25.5,
			description: "Loose rock after rain",
		});
	});

	it("closes and accepts a Polygon while omitting radiusMeters", () => {
		expect(polygon?.coordinates[0][0]).toEqual(polygon?.coordinates[0].at(-1));
		const parsed = createRouteDangerZoneFormSchema.parse({
			geometry: polygon,
			radiusMeters: "",
			description: "Steep landslide boundary",
			severity: "medium",
		});
		expect(toCreateRouteDangerZoneInput(parsed)).toEqual({
			geometry: polygon,
			description: "Steep landslide boundary",
			severity: "medium",
		});
	});

	it.each([
		{ ...point, geometry: undefined },
		{ ...point, geometry: { type: "LineString", coordinates: [] } },
		{ ...point, geometry: { type: "Point", coordinates: [181, 0] } },
		{ ...point, geometry: { type: "Point", coordinates: [0, 91] } },
		{ ...point, radiusMeters: "" },
		{ ...point, radiusMeters: "0" },
		{ ...point, radiusMeters: "Infinity" },
		{ ...point, description: " " },
		{ ...point, description: "x".repeat(1001) },
		{ ...point, severity: "critical" },
	])("rejects invalid Point/common input", (value) => {
		expect(createRouteDangerZoneFormSchema.safeParse(value).success).toBe(false);
	});

	it("rejects open, repeated, undersized, or radius-bearing Polygons", () => {
		const values = (coordinates: Array<[number, number]>, radiusMeters = "") => ({
			geometry: { type: "Polygon", coordinates: [coordinates] },
			radiusMeters,
			description: "Hazard",
			severity: "low",
		});
		expect(
			createRouteDangerZoneFormSchema.safeParse(
				values([
					[108.45, 11.94],
					[108.46, 11.95],
					[108.47, 11.94],
				])
			).success
		).toBe(false);
		expect(
			createRouteDangerZoneFormSchema.safeParse(
				values([
					[108.45, 11.94],
					[108.45, 11.94],
					[108.46, 11.95],
					[108.45, 11.94],
				])
			).success
		).toBe(false);
		expect(
			createRouteDangerZoneFormSchema.safeParse(values(polygon?.coordinates[0] ?? [], "30")).success
		).toBe(false);
	});
});
