import { describe, expect, it } from "vitest";
import {
	formatTime,
	isOutsideRouteArea,
	locationFreshness,
	relativePositionTime,
} from "./participant-position";

const geometry = {
	type: "LineString" as const,
	coordinates: [
		[108.28, 16.1],
		[108.31, 16.12],
	] as [number, number][],
};
const now = Date.parse("2026-11-16T03:00:00Z");
describe("Host monitoring location presentation", () => {
	it("identifies a remote simulator location without classifying route deviation", () => {
		expect(isOutsideRouteArea({ longitude: -122.084, latitude: 37.4219983 }, geometry)).toBe(true);
		expect(isOutsideRouteArea({ longitude: 108.295, latitude: 16.11 }, geometry)).toBe(false);
		expect(isOutsideRouteArea(null, geometry)).toBe(false);
	});
	it("uses the supplied freshness threshold including its boundary", () => {
		expect(locationFreshness(new Date(now - 120_000).toISOString(), true, 120, now)).toBe("fresh");
		expect(locationFreshness(new Date(now - 121_000).toISOString(), true, 120, now)).toBe("stale");
		expect(locationFreshness(new Date(now - 121_000).toISOString(), true, 300, now)).toBe("fresh");
	});
	it("keeps future and missing locations distinguishable from fresh positions", () => {
		expect(locationFreshness(new Date(now + 1).toISOString(), true, 120, now)).toBe("stale");
		expect(locationFreshness(null, false, 120, now)).toBe("unavailable");
	});
	it("expires a cached location as the presentation clock advances", () => {
		const time = new Date(now).toISOString();
		expect(locationFreshness(time, true, 120, now)).toBe("fresh");
		expect(locationFreshness(time, true, 120, now + 121_000)).toBe("stale");
	});
	it("formats full years and relative ages", () => {
		expect(formatTime.format(new Date(now))).toContain("2026");
		expect(relativePositionTime(new Date(now - 6 * 86_400_000).toISOString(), now)).toBe(
			"6 ngày trước"
		);
		expect(relativePositionTime(new Date(now - 20 * 60_000).toISOString(), now)).toBe(
			"20 phút trước"
		);
	});
});
