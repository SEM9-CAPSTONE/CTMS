import { ConfigService } from "@nestjs/config";
import { readProviderJson } from "./nchmf-http";
import { NCHMF, nchmfHour } from "./nchmf-safety.policy";
import { NchmfSafetyService } from "./nchmf-safety.service";
import { parseNchmfWarnings } from "./nchmf-warning";
import { routeEnvelope } from "./route-context.policy";

const NOW = Date.parse("2026-10-30T07:30:00Z");
const geometry = {
	type: "LineString" as const,
	coordinates: [
		[107.27, 21],
		[107.3, 21.01],
	] as [number, number][],
};
const timestamp = (value: string) => `/Date(${Date.parse(value)})/`;
const warning = (patch: Record<string, unknown> = {}) => ({
	commune_id: 8345,
	commune_name: "Phường Cẩm Bình",
	district_name: "TP.Cẩm Phả",
	provinceName: "Quảng Ninh",
	thoigian: timestamp("2026-10-30T07:00:00Z"),
	ngay_capnhat: timestamp("2026-10-30T07:05:00Z"),
	sogiodubao: 6,
	nguycosatlo: "Cao",
	nguycoluquet: "Trung bình",
	...patch,
});
const boundaries = (matched = 1) => ({
	type: "FeatureCollection",
	numberMatched: matched,
	numberReturned: 1,
	features: [
		{
			type: "Feature",
			properties: { gid: 8345 },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[107.26, 20.99],
						[107.31, 20.99],
						[107.31, 21.02],
						[107.26, 20.99],
					],
				],
			},
		},
	],
});
const json = (value: unknown) =>
	new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

describe("NCHMF live collection", () => {
	let fetchMock: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
	beforeEach(() => {
		jest.spyOn(Date, "now").mockReturnValue(NOW);
		fetchMock = jest.spyOn(global, "fetch");
	});
	afterEach(() => jest.restoreAllMocks());
	const service = () => new NchmfSafetyService(new ConfigService());
	const enqueue = (rows: unknown = [warning()], regions: unknown = boundaries()) => {
		fetchMock.mockResolvedValueOnce(json(rows)).mockResolvedValueOnce(json(regions));
	};
	it("fetches this hour in Vietnam and maps both hazards to real administrative polygons", async () => {
		enqueue();
		const result = await service().collect(geometry);
		expect(result.source).toMatchObject({
			status: "LIVE",
			dataTime: "2026-10-30T07:00:00.000Z",
			validUntil: "2026-10-30T13:00:00.000Z",
		});
		expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("date=2026-10-30+14%3A00%3A00");
		const url = new URL(String(fetchMock.mock.calls[1][0]));
		expect(url.searchParams.get("srsName")).toBe("CRS:84");
		expect(url.searchParams.get("bbox")).toBe(`${routeEnvelope(geometry, 300).join(",")},CRS:84`);
		expect(result.candidates).toHaveLength(2);
		expect(result.candidates[0]).toMatchObject({
			severity: "HIGH",
			geometryRole: "administrative_warning_area",
			issuedAt: "2026-10-30T07:05:00.000Z",
		});
		expect(result.candidates[0].geometry.type).toBe("Polygon");
	});
	it("does not reuse a completed response on the next analysis", async () => {
		const provider = service();
		enqueue();
		await provider.collect(geometry);
		enqueue([warning({ nguycosatlo: "Rất cao" })]);
		const next = await provider.collect(geometry);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(next.candidates[0].severity).toBe("VERY_HIGH");
	});
	it("never substitutes the last successful warnings after a network failure", async () => {
		const provider = service();
		enqueue();
		await provider.collect(geometry);
		fetchMock.mockRejectedValueOnce(new Error("timeout"));
		const next = await provider.collect(geometry);
		expect(next.source.status).toBe("UNAVAILABLE");
		expect(next.candidates).toEqual([]);
	});
	it("looks back only two hours for publication delay and reports unavailable data distinctly", async () => {
		for (let i = 0; i < 3; i++) fetchMock.mockResolvedValueOnce(json([]));
		const result = await service().collect(geometry);
		expect(result.source.status).toBe("EMPTY");
		expect(result.source.dataTime).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(String(fetchMock.mock.calls[2][1]?.body)).toContain("12%3A00%3A00");
	});
	it("uses a delayed but still valid source snapshot without changing its timestamp", async () => {
		fetchMock.mockResolvedValueOnce(json([]));
		enqueue([warning({ thoigian: timestamp("2026-10-30T06:00:00Z") })]);
		const result = await service().collect(geometry);
		expect(result.source.dataTime).toBe("2026-10-30T06:00:00.000Z");
		expect(result.source.validUntil).toBe("2026-10-30T12:00:00.000Z");
	});
	it("reports truncation and never claims a complete source check", async () => {
		enqueue([warning()], boundaries(NCHMF.maxBoundaries + 1));
		expect((await service().collect(geometry)).source.status).toBe("PARTIAL");
	});
	it.each([
		["expired", warning({ thoigian: timestamp("2026-10-30T00:00:00Z") })],
		["future", warning({ thoigian: timestamp("2026-10-30T08:00:00Z") })],
		["future issue", warning({ ngay_capnhat: timestamp("2026-10-30T08:00:00Z") })],
		["unknown severity", warning({ nguycosatlo: "new-level" })],
		["missing time", warning({ thoigian: null })],
	])("rejects %s records rather than fabricating current evidence", async (_label, row) => {
		fetchMock.mockResolvedValueOnce(json([row]));
		expect((await service().collect(geometry)).source.status).toBe("UNAVAILABLE");
	});
	it("deduplicates old commune mappings and retains the higher hazard level", () => {
		const rows = parseNchmfWarnings([warning(), warning({ nguycosatlo: "Rất cao" })], NOW);
		expect(rows).toHaveLength(1);
		expect(rows[0].landslide).toBe("VERY_HIGH");
	});
	it("does not contact providers when explicitly disabled", async () => {
		const provider = new NchmfSafetyService(
			new ConfigService({ ROUTE_SAFETY_LIVE_ENABLED: "false" })
		);
		expect((await provider.collect(geometry)).source.status).toBe("DISABLED");
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("rejects invalid geometry and HTML/login responses", async () => {
		enqueue([warning()], {
			...boundaries(),
			features: [{ properties: { gid: 8345 }, geometry: null }],
		});
		expect((await service().collect(geometry)).source.status).toBe("UNAVAILABLE");
		fetchMock.mockResolvedValueOnce(new Response("<html>login</html>"));
		expect((await service().collect(geometry)).source.status).toBe("UNAVAILABLE");
	});
	it("rejects non-success responses and oversized provider bodies", async () => {
		fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
		expect((await service().collect(geometry)).source.status).toBe("UNAVAILABLE");
		fetchMock.mockResolvedValueOnce(new Response("x".repeat(NCHMF.maxResponseBytes + 1)));
		await expect(readProviderJson(new URL(NCHMF.baseUrl), {})).rejects.toThrow("exceeds limit");
	});
	it("formats midnight without relying on the server timezone", () => {
		expect(nchmfHour(Date.parse("2026-10-29T17:30:00Z"))).toBe("2026-10-30 00:00:00");
	});
});
