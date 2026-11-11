import { ConfigService } from "@nestjs/config";
import type { TerrainPosition } from "./terrain.types";
import { WalkingTerrainService } from "./walking-terrain.service";

const geometry = {
	type: "LineString" as const,
	coordinates: [
		[108, 12],
		[108.01, 12],
	] as TerrainPosition[],
};
const samples = geometry.coordinates.map((coordinates, index) => ({
	coordinates,
	distanceMeters: index * 1000,
}));
const unknown = [{ terrain: "UNKNOWN", distanceMeters: 1000 }];
const way = {
	type: "way",
	id: 1,
	tags: { highway: "path", surface: "ground", smoothness: "good" },
	geometry: geometry.coordinates.map(([lon, lat]) => ({ lon, lat })),
};

describe("WalkingTerrainService", () => {
	let fetchMock: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
	beforeEach(() => {
		fetchMock = jest.spyOn(global, "fetch");
	});
	afterEach(() => jest.restoreAllMocks());
	const service = () => new WalkingTerrainService(new ConfigService());
	const signal = () => AbortSignal.timeout(1000);
	it("retrieves road metadata and returns matched walking legs", async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ elements: [way] })));
		expect(await service().collect(geometry, samples, signal())).toEqual([
			{ terrain: "MODERATE", distanceMeters: 1000 },
		]);
		expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("data")).toContain(
			"out tags geom"
		);
	});
	it("does not classify a route from the existence of an unpaved path alone", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ elements: [{ ...way, tags: { highway: "path", surface: "unpaved" } }] })
			)
		);
		expect(await service().collect(geometry, samples, signal())).toEqual(unknown);
	});
	it("does not use incomplete provider results as full road coverage", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ elements: [way], remark: "timeout" }))
		);
		expect(await service().collect(geometry, samples, signal())).toEqual(unknown);
	});
	it("fails silently to unknown coverage on provider errors", async () => {
		fetchMock.mockRejectedValueOnce(new Error("offline"));
		expect(await service().collect(geometry, samples, signal())).toEqual(unknown);
	});
	it("does not query an excessively large route envelope", async () => {
		await service().collect(
			{
				...geometry,
				coordinates: [
					[108, 12],
					[111, 12],
				],
			},
			samples,
			signal()
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
