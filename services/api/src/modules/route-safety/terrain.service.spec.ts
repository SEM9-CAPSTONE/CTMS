import { UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TerrainCacheService } from "./terrain-cache.service";
import { TERRAIN, sampleTerrain, summarizeTerrain } from "./terrain.policy";
import { TerrainService } from "./terrain.service";
import type { TerrainPosition } from "./terrain.types";
import { matchWalkingLegs } from "./walking-terrain.policy";
import type { WalkingTerrainService } from "./walking-terrain.service";

const line = {
	type: "LineString" as const,
	coordinates: [
		[108, 12],
		[108.12, 12],
	] as TerrainPosition[],
};

describe("TerrainService", () => {
	let fetchMock: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
	let cache: TerrainCacheService;
	beforeEach(() => {
		cache = new TerrainCacheService(new ConfigService());
		fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
			const locations =
				new URL(String(input)).pathname.split("/").at(-1)?.replace(".json", "") ?? "";
			return new Response(
				JSON.stringify(
					locations.split(";").map((location) => [...location.split(",").map(Number), 500])
				)
			);
		});
	});
	afterEach(() => {
		jest.restoreAllMocks();
		cache.onModuleDestroy();
	});
	const service = (key = "test-key") =>
		new TerrainService(new ConfigService({ MAPTILER_API_KEY: key }), cache, {
			collect: jest.fn(
				async (_geometry: unknown, samples: ReturnType<typeof sampleTerrain>["samples"]) =>
					matchWalkingLegs(samples, [])
			),
		} as unknown as WalkingTerrainService);

	describe("analyze", () => {
		it("samples between vertices, batches at 50 points and reuses unchanged routes", async () => {
			const api = service();
			const [first, concurrent] = await Promise.all([
				api.analyze("host", line),
				api.analyze("host", line),
			]);
			expect(first.status).toBe("READY");
			expect(first.profile.length).toBeGreaterThan(100);
			expect(first.profile.length).toBeLessThanOrEqual(TERRAIN.maxSamples);
			expect(first).toEqual(concurrent);
			const calls = fetchMock.mock.calls.length;
			for (const [input] of fetchMock.mock.calls)
				expect(new URL(String(input)).pathname.split(";").length).toBeLessThanOrEqual(50);
			expect(await api.analyze("host", line)).toEqual(first);
			expect(fetchMock).toHaveBeenCalledTimes(calls);
			await api.analyze("host", {
				...line,
				coordinates: [
					[108, 12],
					[108.01, 12],
				],
			});
			expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
		});
		it("returns distance-only guidance without a configured key", async () => {
			const result = await service("").analyze("host", line);
			expect(result).toMatchObject({ status: "NOT_CONFIGURED", ascentMeters: null, profile: [] });
			expect(result.estimatedMinutes).toBeGreaterThan(0);
			expect(fetchMock).not.toHaveBeenCalled();
		});
		it.each([403, 429, 500])("does not manufacture elevation on HTTP %s", async (status) => {
			fetchMock.mockResolvedValueOnce(new Response("unavailable", { status }));
			expect(await service().analyze("host", line)).toMatchObject({
				status: "UNAVAILABLE",
				ascentMeters: null,
				profile: [],
			});
		});
		it("rejects incomplete responses without caching them", async () => {
			fetchMock.mockResolvedValueOnce(new Response("[]"));
			const api = service();
			expect((await api.analyze("host", line)).status).toBe("UNAVAILABLE");
			expect((await api.analyze("host", line)).status).toBe("READY");
		});
		it.each(["coordinate", "elevation"])(
			"rejects invalid %s values even when row count matches",
			async (invalid) => {
				const rows: unknown[][] = sampleTerrain(line.coordinates)
					.samples.slice(0, TERRAIN.batchSize)
					.map((sample) => [...sample.coordinates, 500]);
				if (invalid === "coordinate") rows[0][0] = 0;
				else rows[0][2] = null;
				fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rows)));
				expect(await service().analyze("host", line)).toMatchObject({
					status: "UNAVAILABLE",
					profile: [],
				});
			}
		);
		it("falls back on network errors", async () => {
			fetchMock.mockRejectedValueOnce(new Error("network"));
			expect(await service().analyze("host", line)).toMatchObject({
				status: "UNAVAILABLE",
				profile: [],
			});
		});
		it("rejects invalid and zero-length routes before contacting the provider", async () => {
			await expect(
				service().analyze("host", {
					...line,
					coordinates: [
						[108, 12],
						[108, 12],
					],
				})
			).rejects.toBeInstanceOf(UnprocessableEntityException);
			await expect(
				service().analyze("host", {
					...line,
					coordinates: [
						[108, 91],
						[108, 12],
					],
				})
			).rejects.toBeInstanceOf(UnprocessableEntityException);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
	describe("validateMinimumDuration", () => {
		it("rejects a duration below the distance floor before spending API quota", async () => {
			await expect(service().validateMinimumDuration("host", line, 1)).rejects.toMatchObject({
				response: { code: "ROUTE_DURATION_TOO_SHORT" },
			});
			expect(fetchMock).not.toHaveBeenCalled();
		});
		it("keeps the distance floor usable when elevation fails", async () => {
			fetchMock.mockRejectedValueOnce(new Error("network"));
			await expect(service().validateMinimumDuration("host", line, 300)).resolves.toBeUndefined();
		});
		it("enforces the complete estimate when it exceeds the distance floor", async () => {
			const api = service();
			const analyzed = await api.analyze("host", line);
			jest
				.spyOn(api, "analyze")
				.mockResolvedValue({ ...analyzed, minimumMinutes: 300, estimateBasis: "TCVN" });
			await expect(api.validateMinimumDuration("host", line, 299)).rejects.toMatchObject({
				response: { minimumMinutes: 300 },
			});
			await expect(api.validateMinimumDuration("host", line, 300)).resolves.toBeUndefined();
		});
	});
});

describe("Terrain calculations", () => {
	it("combines the entire 10 km profile into 265 minutes without adding a return leg", () => {
		const profile = Array.from({ length: 101 }, (_, index) => ({
			coordinates: [108 + index * 0.001, 12] as TerrainPosition,
			distanceMeters: index * 100,
			elevationMeters: index <= 50 ? 100 + index * 6 : 400 - (index - 50) * 4,
			slopePercent: 0,
		}));
		expect(
			summarizeTerrain(profile, 10_000, 100, [{ distanceMeters: 10_000, terrain: "MODERATE" }])
		).toMatchObject({
			ascentMeters: 300,
			descentMeters: 200,
			estimatedMinutes: 265,
			minimumMinutes: 265,
			estimateBasis: "TCVN",
		});
	});
	it("counts both ascent and descent in the TCVN combination", () => {
		const profile = [100, 160, 130].map((elevationMeters, index) => ({
			coordinates: [108, 12] as TerrainPosition,
			distanceMeters: index * 100,
			elevationMeters,
			slopePercent: 0,
		}));
		const result = summarizeTerrain(profile, 200, 100);
		expect(result).toMatchObject({
			ascentMeters: 60,
			descentMeters: 30,
			maxSlopePercent: 60,
			estimatedMinutes: 26,
			minimumMinutes: 3,
			estimateBasis: "PARTIAL",
		});
		expect(result.profile[2].slopePercent).toBe(-30);
	});
	it("caps samples for a long route, retains both endpoints and handles duplicate vertices", () => {
		const result = sampleTerrain([
			[108, 12],
			[108, 12],
			[111, 12],
		]);
		expect(result.samples).toHaveLength(TERRAIN.maxSamples);
		expect(result.samples[0].coordinates[0]).toBeCloseTo(108);
		expect(result.samples.at(-1)?.coordinates[0]).toBeCloseTo(111);
		expect(result.sampleSpacingMeters).toBeGreaterThan(1000);
	});
	it("suppresses small elevation jitter while retaining gradual gains", () => {
		const profile = [100, 101, 102, 103, 102].map((elevationMeters, index) => ({
			coordinates: [108, 12] as TerrainPosition,
			distanceMeters: index * 100,
			elevationMeters,
			slopePercent: 0,
		}));
		expect(summarizeTerrain(profile, 400, 100)).toMatchObject({
			ascentMeters: 3,
			descentMeters: 0,
		});
	});
});
