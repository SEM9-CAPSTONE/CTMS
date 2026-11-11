import { describe, expect, it } from "vitest";
import {
	MAX_ROUTE_IMPORT_BYTES,
	approximateLengthMeters,
	parseGeoJsonRoute,
	parseGpxRoute,
	parseRouteImportFile,
} from "./route-import";

const coordinates: [number, number][] = [
	[108.45, 11.94],
	[108.46, 11.95],
];

describe("route import", () => {
	it.each([
		JSON.stringify({ type: "LineString", coordinates }),
		JSON.stringify({
			type: "Feature",
			properties: {},
			geometry: { type: "LineString", coordinates },
		}),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
			],
		}),
	])("accepts supported GeoJSON shapes", (input) => {
		expect(parseGeoJsonRoute(input)).toEqual({ type: "LineString", coordinates });
	});

	it.each(["Point", "Polygon", "MultiLineString"])("rejects GeoJSON %s", (type) => {
		expect(() => parseGeoJsonRoute(JSON.stringify({ type, coordinates }))).toThrow();
	});

	it("rejects malformed and ambiguous FeatureCollections", () => {
		expect(() => parseGeoJsonRoute("{")).toThrow();
		expect(() =>
			parseGeoJsonRoute(
				JSON.stringify({
					type: "FeatureCollection",
					features: [
						{ type: "Feature", geometry: { type: "LineString", coordinates } },
						{ type: "Feature", geometry: { type: "LineString", coordinates } },
					],
				})
			)
		).toThrow(/duy nhất/);
	});

	it("accepts one GPX track or one route and ignores elevation", () => {
		expect(
			parseGpxRoute(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
			<trkpt lat="11.94" lon="108.45"><ele>100</ele></trkpt><trkpt lat="11.95" lon="108.46" />
		</trkseg></trk></gpx>`).coordinates
		).toEqual(coordinates);
		expect(
			parseGpxRoute(
				`<gpx><rte><rtept lat="11.94" lon="108.45"/><rtept lat="11.95" lon="108.46"/></rte></gpx>`
			).coordinates
		).toEqual(coordinates);
	});

	it("rejects ambiguous GPX and malformed coordinates", () => {
		expect(() => parseGpxRoute("<gpx><trk/><rte/></gpx>")).toThrow(/duy nhất/);
		expect(() => parseGpxRoute("<gpx><trk><trkpt lat='x' lon='1'/></trk></gpx>")).toThrow(
			/không hợp lệ/
		);
	});

	it("enforces the 5 MB limit", async () => {
		const oversized = new File([new Uint8Array(MAX_ROUTE_IMPORT_BYTES + 1)], "route.gpx");
		await expect(parseRouteImportFile(oversized)).rejects.toThrow(/5 MB/);
	});

	it("calculates a non-authoritative preview", () => {
		expect(approximateLengthMeters(coordinates)).toBeGreaterThan(1_000);
	});
});
