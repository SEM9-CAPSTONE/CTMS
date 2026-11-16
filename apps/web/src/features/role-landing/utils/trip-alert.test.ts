import { describe, expect, it } from "vitest";
import type { TripAlert } from "../types/trip-alert";
import { filterTripAlerts } from "./trip-alert";

const offRoute: TripAlert = {
	participantId: "member",
	role: "camper",
	name: "Nguyễn Văn An",
	alertType: "OFF_ROUTE",
	severity: null,
	observedAt: "2026-11-16T01:00:00Z",
	location: null,
	lastLocationAt: null,
	freshness: "unavailable",
	isStale: false,
};
const behind: TripAlert = { ...offRoute, alertType: "BEHIND_SCHEDULE", severity: "BEHIND" };
const severe: TripAlert = { ...behind, participantId: "other", severity: "SEVERELY_BEHIND" };
describe("Host alert presentation", () => {
	it("retains two authoritative alerts for one member without mutating the source", () => {
		const source = [offRoute, behind];
		expect(filterTripAlerts(source, "", "")).toEqual([behind, offRoute]);
		expect(source).toEqual([offRoute, behind]);
	});
	it("excludes null-severity off-route alerts when filtering severity", () => {
		expect(filterTripAlerts([offRoute, behind, severe], "", "BEHIND")).toEqual([behind]);
		expect(filterTripAlerts([offRoute, behind], "OFF_ROUTE", "BEHIND")).toEqual([]);
	});
	it("filters type and orders severity before most recent observation", () => {
		const newer = { ...behind, observedAt: "2026-11-16T02:00:00Z" };
		expect(filterTripAlerts([behind, offRoute, newer, severe], "BEHIND_SCHEDULE", "")).toEqual([
			severe,
			newer,
			behind,
		]);
	});
	it("keeps an empty authorized result empty", () => {
		expect(filterTripAlerts([], "", "")).toEqual([]);
	});
});
