import type { EntityManager } from "typeorm";
import { WeatherSnapshot, WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";
import { WeatherSnapshotsRepository } from "./weather-snapshots.repository";

describe("WeatherSnapshotsRepository", () => {
	function makeRepository() {
		return new WeatherSnapshotsRepository(WeatherSnapshot, {} as EntityManager);
	}

	describe("findRouteForFetch", () => {
		it("computes the route's centroid via ST_Centroid, not per-checkpoint", async () => {
			const repository = makeRepository();
			const query = jest
				.spyOn(repository, "query")
				.mockResolvedValue([
					{ id: "route-1", status: "active", hostId: "host-1", centroid: [108.46, 11.94] },
				]);

			const result = await repository.findRouteForFetch("route-1");

			expect(query.mock.calls[0][0]).toContain("ST_Centroid");
			expect(query.mock.calls[0][0]).not.toContain("FOR UPDATE");
			expect(query).toHaveBeenCalledWith(expect.any(String), ["route-1"]);
			expect(result).toEqual({
				id: "route-1",
				status: "active",
				hostId: "host-1",
				centroid: [108.46, 11.94],
			});
		});

		it("returns null when the route does not exist", async () => {
			const repository = makeRepository();
			jest.spyOn(repository, "query").mockResolvedValue([]);

			expect(await repository.findRouteForFetch("missing")).toBeNull();
		});
	});

	describe("createSuccess / createFailed", () => {
		it("inserts a SUCCESS row with every provided field and a null errorMessage", async () => {
			const repository = makeRepository();
			const observedAt = new Date("2026-08-29T11:30:00Z");
			const query = jest.spyOn(repository, "query").mockResolvedValue([
				{
					id: "snap-1",
					routeId: "route-1",
					status: WeatherSnapshotStatus.SUCCESS,
					observedAt,
					errorMessage: null,
				},
			]);

			const result = await repository.createSuccess({
				routeId: "route-1",
				observedAt,
				rainfallMm: 0,
				windKph: 10.4,
				temperatureC: 32.2,
				visibilityM: 23780,
				thunderstorm: false,
				providerWeatherCode: 3,
				providerResponse: { current: {} },
			});

			expect(query.mock.calls[0][0]).toContain('INSERT INTO "weather_snapshots"');
			expect(query.mock.calls[0][1]).toEqual([
				"route-1",
				WeatherSnapshotStatus.SUCCESS,
				observedAt,
				0,
				10.4,
				32.2,
				23780,
				false,
				3,
				JSON.stringify({ current: {} }),
			]);
			expect(result).toEqual(
				expect.objectContaining({
					routeId: "route-1",
					status: WeatherSnapshotStatus.SUCCESS,
					errorMessage: null,
				})
			);
		});

		it("inserts a FAILED row with only routeId/status/errorMessage set", async () => {
			const repository = makeRepository();
			const query = jest
				.spyOn(repository, "query")
				.mockResolvedValue([
					{ id: "snap-2", routeId: "route-1", status: WeatherSnapshotStatus.FAILED },
				]);

			const result = await repository.createFailed({
				routeId: "route-1",
				errorMessage: "provider down",
			});

			expect(query).toHaveBeenCalledWith(expect.any(String), [
				"route-1",
				WeatherSnapshotStatus.FAILED,
				"provider down",
			]);
			expect(result).toEqual(
				expect.objectContaining({ routeId: "route-1", status: WeatherSnapshotStatus.FAILED })
			);
		});
	});

	describe("findLatestForRoute", () => {
		it("orders by created_at DESC and limits to 1", async () => {
			const repository = makeRepository();
			const query = jest.spyOn(repository, "query").mockResolvedValue([]);

			const result = await repository.findLatestForRoute("route-1");

			expect(query.mock.calls[0][0]).toContain('ORDER BY "created_at" DESC');
			expect(query.mock.calls[0][0]).toContain("LIMIT 1");
			expect(query).toHaveBeenCalledWith(expect.any(String), ["route-1"]);
			expect(result).toBeNull();
		});
	});
});
