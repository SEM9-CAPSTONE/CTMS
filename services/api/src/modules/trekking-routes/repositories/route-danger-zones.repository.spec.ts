import type { EntityManager } from "typeorm";
import { RouteDangerZone, RouteDangerZoneSeverity } from "../entities/route-danger-zone.entity";
import { RouteDangerZonesRepository } from "./route-danger-zones.repository";

const pointGeometry = {
	type: "Point" as const,
	coordinates: [108.458313, 11.940419] as [number, number],
};

const row = {
	id: "danger-zone-id",
	routeId: "route-id",
	geometry: pointGeometry,
	radiusMeters: "50",
	description: "Falling-rock area",
	severity: RouteDangerZoneSeverity.MEDIUM,
	createdAt: new Date("2026-09-04T00:00:00.000Z"),
	updatedAt: new Date("2026-09-04T00:00:00.000Z"),
};

describe("RouteDangerZonesRepository", () => {
	it("returns authoritative geometry in deterministic order", async () => {
		const repository = new RouteDangerZonesRepository(RouteDangerZone, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([row]);
		const result = await repository.findByRoute("route-id");
		expect(query.mock.calls[0][0]).toContain('ORDER BY "created_at" ASC, "id" ASC');
		expect(query.mock.calls[0][0]).toContain('ST_AsGeoJSON("geom"::geometry)::json');
		expect(query.mock.calls[0][1]).toEqual(["route-id"]);
		expect(result[0]).toEqual(
			expect.objectContaining({ geometry: pointGeometry, radiusMeters: 50 })
		);
	});

	it("uses PostGIS validity checks and persists the approved Point fields", async () => {
		const repository = new RouteDangerZonesRepository(RouteDangerZone, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([row]);
		await expect(
			repository.createForRoute({
				routeId: "route-id",
				geometry: pointGeometry,
				radiusMeters: 50,
				description: "Falling-rock area",
				severity: RouteDangerZoneSeverity.MEDIUM,
			})
		).resolves.toEqual(expect.objectContaining({ radiusMeters: 50 }));

		const normalizedSql = (query.mock.calls[0][0] as string).replace(/\s+/g, " ");
		const parameters = query.mock.calls[0][1] as unknown[];
		expect(normalizedSql).toContain("ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)");
		expect(normalizedSql).toContain("GeometryType(geom) IN ('POINT', 'POLYGON')");
		expect(normalizedSql).toContain("ST_IsValid(geom)");
		expect(parameters).toEqual([
			"route-id",
			JSON.stringify(pointGeometry),
			50,
			"Falling-rock area",
			RouteDangerZoneSeverity.MEDIUM,
		]);
	});

	it("returns 422 when PostGIS rejects an invalid Polygon", async () => {
		const repository = new RouteDangerZonesRepository(RouteDangerZone, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);
		await expect(
			repository.createForRoute({
				routeId: "route-id",
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[108.45, 11.94],
							[108.46, 11.95],
							[108.45, 11.95],
							[108.46, 11.94],
							[108.45, 11.94],
						],
					],
				},
				radiusMeters: null,
				description: "Invalid polygon",
				severity: RouteDangerZoneSeverity.HIGH,
			})
		).rejects.toMatchObject({ status: 422 });
	});
});
