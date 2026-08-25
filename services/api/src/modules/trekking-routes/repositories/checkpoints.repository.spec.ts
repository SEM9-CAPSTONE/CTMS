import type { EntityManager } from "typeorm";
import { Checkpoint, CheckpointType } from "../entities/checkpoint.entity";
import { CheckpointsRepository } from "./checkpoints.repository";

const row = {
	id: "checkpoint-id",
	routeId: "route-id",
	name: "Ridge rest",
	location: { type: "Point" as const, coordinates: [108.458313, 11.940419] as [number, number] },
	radiusMeters: "30",
	type: CheckpointType.REST,
	expectedArrivalOffset: "45",
	instructions: "Rest and check water.",
	nearbyWaterOrShelter: true,
	routePosition: "0.3725",
	createdAt: new Date("2026-08-25T00:00:00.000Z"),
	updatedAt: new Date("2026-08-25T00:00:00.000Z"),
};

describe("CheckpointsRepository", () => {
	it("returns route checkpoints in canonical deterministic order", async () => {
		const repository = new CheckpointsRepository(Checkpoint, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([row]);
		const result = await repository.findByRoute("route-id");
		expect(query.mock.calls[0][0]).toContain(
			'ORDER BY "route_position" ASC, "created_at" ASC, "id" ASC'
		);
		expect(query.mock.calls[0][1]).toEqual(["route-id"]);
		expect(result[0]).toEqual(
			expect.objectContaining({
				radiusMeters: 30,
				expectedArrivalOffset: 45,
				routePosition: 0.3725,
			})
		);
	});

	it("uses geography ST_DWithin, preserves the Point, and calculates route position", async () => {
		const repository = new CheckpointsRepository(Checkpoint, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([row]);
		const result = await repository.createForRoute({
			routeId: "route-id",
			name: "Ridge rest",
			location: row.location,
			radiusMeters: 30,
			type: CheckpointType.REST,
			expectedArrivalOffset: 45,
			instructions: "Rest and check water.",
			nearbyWaterOrShelter: true,
		});
		const sql = query.mock.calls[0][0];
		const normalizedSql = sql.replace(/\s+/g, " ");
		const parameters = query.mock.calls[0][1] as unknown[];
		expect(normalizedSql).toContain(
			'ST_DWithin( route."route_geom", checkpoint_input.location, 50 )'
		);
		expect(sql).not.toContain("ST_Distance");
		expect(sql).toContain("ST_LineLocatePoint");
		expect(sql).toContain("ST_AsGeoJSON");
		expect(parameters[2]).toBe(JSON.stringify(row.location));
		expect(result.location).toEqual(row.location);
	});

	it("returns 422 when PostGIS rejects a Point farther than 50 meters", async () => {
		const repository = new CheckpointsRepository(Checkpoint, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);
		await expect(
			repository.createForRoute({
				routeId: "route-id",
				name: "Far point",
				location: row.location,
				radiusMeters: 30,
				type: CheckpointType.REST,
				expectedArrivalOffset: 45,
				instructions: "Too far",
				nearbyWaterOrShelter: false,
			})
		).rejects.toMatchObject({ status: 422 });
	});
});
