import { ConfigService } from "@nestjs/config";
import { osmWater } from "./osm-water";
import { OsmWaterService } from "./osm-water.service";
import { vndmsEvent } from "./vndms-event";
import { VndmsSafetyService } from "./vndms-safety.service";

const fetched = "2026-10-30T08:00:00Z";
const event = {
	id: 4963,
	name_vn: "Sạt lở đất tại Đồng Tháp",
	lon: 105.371835,
	lat: 10.697067,
	time_start: "2026-10-19T18:50:00",
	time_update: "2026-10-19T18:50:00",
	da_ketthuc: true,
	disaster_level: "1",
};
const route = {
	type: "LineString" as const,
	coordinates: [
		[108.43, 11.94],
		[108.431, 11.941],
	] as [number, number][],
};
const spring = {
	type: "node",
	id: 42,
	lon: 108.4305,
	lat: 11.9405,
	tags: { natural: "spring", drinking_water: "no", name: "Suối thử" },
};
const json = (value: unknown) => new Response(JSON.stringify(value));

describe("VNDMS event collection", () => {
	afterEach(() => jest.restoreAllMocks());
	it("preserves reported coordinates, source local time and ended status without inventing a footprint or severity", () => {
		const result = vndmsEvent(event, fetched, "https://vndms.gov.vn/");
		expect(result).toMatchObject({
			sourceType: "BASE_HISTORICAL",
			lifecycleStatus: "RESOLVED",
			severity: "UNKNOWN",
			geometry: { type: "Point", coordinates: [105.371835, 10.697067] },
			observedAt: "2026-10-19T11:50:00.000Z",
		});
		expect(result?.description).toContain("Cấp rủi ro do nguồn cung cấp: 1");
		expect(vndmsEvent({ ...event, lon: null }, fetched, "ref")).toBeNull();
		expect(vndmsEvent({ ...event, time_start: "2027-01-01T00:00:00" }, fetched, "ref")).toBeNull();
		expect(vndmsEvent({ ...event, da_ketthuc: false }, fetched, "ref")).toMatchObject({
			sourceType: "OFFICIAL_CURRENT",
			lifecycleStatus: "ACTIVE",
		});
	});
	it("collects both years on each analysis and reports rejected records as partial", async () => {
		const fetchMock = jest
			.spyOn(global, "fetch")
			.mockImplementation(async () => json([event, { ...event, id: 1, lat: 900 }]));
		const provider = new VndmsSafetyService(new ConfigService());
		const first = await provider.collect();
		expect(first.source.status).toBe("PARTIAL");
		expect(first.candidates).toHaveLength(1);
		await provider.collect();
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("keyword")).toBe("");
	});
	it("retains one successful year independently and never substitutes history for a failed fetch", async () => {
		const fetchMock = jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(json([event]))
			.mockRejectedValue(new Error("offline"));
		const provider = new VndmsSafetyService(new ConfigService());
		expect((await provider.collect()).source.status).toBe("PARTIAL");
		expect((await provider.collect()).source.status).toBe("UNAVAILABLE");
		fetchMock.mockResolvedValue(new Response("<html>login</html>"));
		expect((await provider.collect()).candidates).toEqual([]);
	});
});

describe("OSM nearby water collection", () => {
	afterEach(() => jest.restoreAllMocks());
	it("keeps water unverified, retains stream lines and excludes surface water", () => {
		expect(osmWater(spring, fetched)).toMatchObject({
			sourceType: "RESOURCE",
			severity: "UNKNOWN",
			observedAt: null,
			verificationStatus: "UNVERIFIED",
		});
		expect(osmWater(spring, fetched)?.description).toContain("không uống được");
		expect(
			osmWater(
				{
					type: "way",
					id: 9,
					tags: { waterway: "stream" },
					geometry: [
						{ lon: 108, lat: 12 },
						{ lon: 108.01, lat: 12 },
					],
				},
				fetched
			)?.geometry.type
		).toBe("LineString");
		expect(
			osmWater(
				{
					type: "way",
					id: 10,
					tags: { natural: "water" },
					geometry: [
						{ lon: 108, lat: 12 },
						{ lon: 108.01, lat: 12 },
						{ lon: 108, lat: 12.01 },
						{ lon: 108, lat: 12 },
					],
				},
				fetched
			)
		).toBeNull();
	});
	it("bounds requests around the full route and separates partial runtime results from empty data", async () => {
		const mock = jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(json({ elements: [spring], remark: "runtime limit" }));
		const result = await new OsmWaterService(new ConfigService()).collect(route, 300);
		expect(result.source.status).toBe("PARTIAL");
		expect(result.candidates).toHaveLength(1);
		expect(new URL(String(mock.mock.calls[0][0])).searchParams.get("bbox")).toBeTruthy();
	});
	it("uses the bounded OSM map API first and reconstructs water ways from node references", async () => {
		const mock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
			json({
				elements: [
					spring,
					{ type: "node", id: 43, lon: 108.431, lat: 11.941 },
					{ type: "way", id: 7, nodes: [42, 43], tags: { waterway: "stream" } },
					{ type: "node", id: 99, lon: 108, lat: 12 },
					{ type: "way", id: 100, nodes: [42, 43, 42], tags: { natural: "water" } },
				],
			})
		);
		const result = await new OsmWaterService(new ConfigService()).collect(route, 300);
		expect(String(mock.mock.calls[0][0])).toContain("api.openstreetmap.org/api/0.6/map.json?bbox=");
		expect(mock).toHaveBeenCalledTimes(1);
		expect(result.source.status).toBe("LIVE");
		expect(result.candidates.map((r) => r.geometry.type)).toEqual(["Point", "LineString"]);
	});
	it("falls back to Overpass when the map API fails", async () => {
		const mock = jest
			.spyOn(global, "fetch")
			.mockRejectedValueOnce(new Error("map unavailable"))
			.mockResolvedValueOnce(json({ elements: [spring] }));
		const result = await new OsmWaterService(new ConfigService()).collect(route, 300);
		expect(new URL(String(mock.mock.calls[1][0])).searchParams.get("data")).toContain(
			'"natural"="spring"'
		);
		expect(new URL(String(mock.mock.calls[1][0])).searchParams.get("data")).not.toContain(
			'"natural"="water"'
		);
		expect(result.source.status).toBe("LIVE");
	});
	it("does not wait for a hung map server and aborts it after the second reader succeeds", async () => {
		let mapSignal: AbortSignal | null | undefined;
		jest
			.spyOn(global, "fetch")
			.mockImplementationOnce((_url, init) => {
				mapSignal = init?.signal;
				return new Promise<Response>((_resolve, reject) =>
					mapSignal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
				);
			})
			.mockResolvedValueOnce(json({ elements: [spring] }));
		const result = await new OsmWaterService(new ConfigService()).collect(route, 300);
		expect(result.source.status).toBe("LIVE");
		expect(mapSignal?.aborted).toBe(true);
	});
	it("reports failures, missing geometry and disabled providers without fabricated locations", async () => {
		const mock = jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
		const provider = new OsmWaterService(new ConfigService());
		expect((await provider.collect(route, 300)).source.status).toBe("UNAVAILABLE");
		mock.mockResolvedValue(json({ elements: [{ ...spring, lon: null }] }));
		expect((await provider.collect(route, 300)).source.status).toBe("PARTIAL");
		mock.mockClear();
		expect(
			(
				await new OsmWaterService(
					new ConfigService({ ROUTE_SAFETY_WATER_ENABLED: "false" })
				).collect(route, 300)
			).source.status
		).toBe("DISABLED");
		expect(
			(
				await new VndmsSafetyService(
					new ConfigService({ ROUTE_SAFETY_VNDMS_ENABLED: "false" })
				).collect()
			).source.status
		).toBe("DISABLED");
		expect(mock).not.toHaveBeenCalled();
	});
});
