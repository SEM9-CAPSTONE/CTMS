import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "../types";
import { decodeRoutePolyline, fetchRouteDirections } from "./route-directions.service";

const start: Position = [107.579, 16.468];
const bend: Position = [107.5793, 16.4684];
const stop: Position = [107.58, 16.468];
const finish: Position = [107.5806, 16.469];
const firstLeg = "_acl^ofbelE_XwQ~Wwj@";
const secondLeg = "_acl^_edelEo}@od@";

const request = (points = [start, stop]) =>
	fetchRouteDirections(points, new AbortController().signal);
const mockResponse = (...geometries: unknown[]) =>
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({
				route: { legs: geometries.map((geometry) => ({ geometry })) },
			})
		)
	);

beforeEach(() => vi.stubEnv("VITE_MAPTILER_API_KEY", "unit-test"));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("MapTiler pedestrian directions", () => {
	it("decodes six decimal places with negative deltas and GeoJSON order", () => {
		expect(decodeRoutePolyline(firstLeg)).toEqual([start, bend, stop]);
		expect(() => decodeRoutePolyline(`${firstLeg}~`)).toThrow("không hợp lệ");
	});

	it("posts ordered pedestrian waypoints and retains each bend of each leg", async () => {
		mockResponse(firstLeg, secondLeg);
		await expect(request([start, stop, finish])).resolves.toEqual({
			type: "LineString",
			coordinates: [start, bend, stop, finish],
		});
		const [[url, init]] = vi.mocked(fetch).mock.calls;
		expect(String(url)).toBe("https://api.maptiler.com/routing/v1/directions?key=unit-test");
		expect(init).toMatchObject({ method: "POST" });
		expect(JSON.parse(String(init?.body))).toEqual({
			profile: "pedestrian",
			locations: [start, stop, finish].map(([lon, lat]) => ({ lon, lat, waypoint: true })),
		});
	});

	it("accepts positional responses and rejects remote snaps and disconnected legs", async () => {
		mockResponse([start, bend, stop]);
		await expect(request()).resolves.toMatchObject({ coordinates: [start, bend, stop] });
		const remote: Position = [107.585, 16.468];
		await expect(request([remote, stop])).rejects.toMatchObject({ waypointIndices: [0] });
		await expect(request([start, remote])).rejects.toMatchObject({ waypointIndices: [1] });
		await expect(request([remote, remote])).rejects.toMatchObject({ waypointIndices: [0, 1] });
		mockResponse([start, stop], [[107.5801, 16.468], finish]);
		await expect(request([start, stop, finish])).rejects.toThrow("không hợp lệ");
	});

	it("rejects missing, malformed, empty, and oversized lines", async () => {
		mockResponse();
		await expect(request()).rejects.toThrow("Không tìm thấy");
		for (const geometry of ["", "~", [[200, 16], stop], [start, start]]) {
			mockResponse(geometry);
			await expect(request()).rejects.toThrow();
		}
		mockResponse([
			start,
			...Array.from({ length: 10_000 }, (_, index) => (index % 2 ? start : bend)),
			stop,
		]);
		await expect(request()).rejects.toThrow("10.000");
	});

	it.each([
		[400, "Hãy kiểm tra lại"],
		[403, "chưa được cấp quyền"],
		[429, "quá nhiều yêu cầu"],
		[500, "đang gián đoạn"],
	])("localizes HTTP %i errors", async (status, message) => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json({ message: "Private provider detail" }, { status }))
		);
		await expect(request()).rejects.toThrow(message);
	});

	it("handles a provider no-route code, network error, and request timeout", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json({ code: "MT_PATH_NOT_FOUND" }, { status: 400 }))
		);
		await expect(request()).rejects.toThrow("Không tìm thấy");
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));
		await expect(request()).rejects.toThrow("Không thể kết nối");
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockImplementation(
					(_, init) =>
						new Promise((_, reject) =>
							init?.signal?.addEventListener("abort", () => reject(new Error("Abort")))
						)
				)
		);
		const check = expect(request()).rejects.toThrow("quá thời gian chờ");
		await vi.advanceTimersByTimeAsync(12_000);
		await check;
	});
});
