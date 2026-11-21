import { describe, expect, it } from "vitest";
import { groupMonitoringMarkers } from "./monitoring-marker-groups";

describe("monitoring marker groups", () => {
	it("groups coincident participants while preserving each identity", () => {
		const people = Array.from({ length: 40 }, (_, id) => ({ id, x: 12, y: 18 }));
		expect(groupMonitoringMarkers(people, (point) => point)).toEqual([people]);
		expect(people).toHaveLength(40);
	});
	it("separates markers when their projected positions spread after zoom", () => {
		const people = [
			{ id: "one", x: 12, y: 18 },
			{ id: "two", x: 120, y: 180 },
		];
		expect(groupMonitoringMarkers(people, (point) => point)).toEqual([[people[0]], [people[1]]]);
	});
	it("supports an empty Trip", () => {
		expect(groupMonitoringMarkers([], () => ({ x: 0, y: 0 }))).toEqual([]);
	});
	it("does not cluster below the configured minimum", () => {
		const people = [
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
		];
		expect(groupMonitoringMarkers(people, (point) => point)).toEqual([[people[0]], [people[1]]]);
	});
});
