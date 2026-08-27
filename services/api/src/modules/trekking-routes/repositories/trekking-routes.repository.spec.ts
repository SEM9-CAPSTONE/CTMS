import type { EntityManager } from "typeorm";
import {
	TrekkingRoute,
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../entities/trekking-route.entity";
import { TrekkingRoutesRepository } from "./trekking-routes.repository";

describe("TrekkingRoutesRepository", () => {
	it("locks and maps the authoritative route for a lifecycle transition", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				campsiteId: "campsite-id",
				hostId: "host-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.ACTIVE,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
				integrityValid: true,
			},
		]);

		const locked = await repository.findOneForLifecycleUpdate("route-id");

		expect(query.mock.calls[0][0]).toContain("FOR UPDATE OF route");
		expect(query.mock.calls[0][0]).toContain("ST_IsValid");
		expect(query).toHaveBeenCalledWith(expect.any(String), ["route-id"]);
		expect(locked).toEqual({
			hostId: "host-id",
			integrityValid: true,
			route: expect.objectContaining({
				id: "route-id",
				lengthMeters: 1024.5,
				expectedDurationMinutes: 90,
				status: TrekkingRouteStatus.ACTIVE,
			}),
		});
	});

	it("returns null when the lifecycle route does not exist", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(repository.findOneForLifecycleUpdate("missing-route")).resolves.toBeNull();
	});

	it("updates only the server-selected status and returns the authoritative row", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				campsiteId: "campsite-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.CLOSED,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-25T00:00:00.000Z"),
			},
		]);

		const route = await repository.updateStatus("route-id", TrekkingRouteStatus.CLOSED);

		expect(query).toHaveBeenCalledWith(expect.stringContaining('SET "status" = $2'), [
			"route-id",
			TrekkingRouteStatus.CLOSED,
		]);
		expect(route).toEqual(expect.objectContaining({ status: TrekkingRouteStatus.CLOSED }));
	});

	it("lists campsite routes with GeoJSON geometry and numeric values", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				campsiteId: "campsite-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.DRAFT,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
			},
		]);

		const routes = await repository.findByCampsite("campsite-id");

		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('ST_AsGeoJSON("route_geom"::geometry)'),
			["campsite-id"]
		);
		expect(query.mock.calls[0][0]).toContain('WHERE "campsite_id" = $1');
		expect(routes[0]).toEqual(
			expect.objectContaining({
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: 1024.5,
				expectedDurationMinutes: 90,
			})
		);
	});

	it("uses PostGIS ST_Length and maps the authoritative database row", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				campsiteId: "campsite-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.DRAFT,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
			},
		]);

		const route = await repository.createDraft({
			campsiteId: "campsite-id",
			name: "Ridge Trail",
			description: null,
			geometry: {
				type: "LineString",
				coordinates: [
					[108.441, 11.941],
					[108.449, 11.946],
				],
			},
			difficulty: TrekkingRouteDifficulty.HARD,
			expectedDurationMinutes: 90,
		});

		expect(query.mock.calls[0][0]).toContain("ST_Length(route_geom)");
		expect(route.lengthMeters).toBe(1024.5);
		expect(route.expectedDurationMinutes).toBe(90);
		expect(route.status).toBe(TrekkingRouteStatus.DRAFT);
	});

	it("returns 422 when PostGIS calculates zero length", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(
			repository.createDraft({
				campsiteId: "campsite-id",
				name: "Zero route",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108, 11],
						[108, 11],
					],
				},
				difficulty: TrekkingRouteDifficulty.EASY,
				expectedDurationMinutes: 30,
			})
		).rejects.toMatchObject({ status: 422 });
	});
});
