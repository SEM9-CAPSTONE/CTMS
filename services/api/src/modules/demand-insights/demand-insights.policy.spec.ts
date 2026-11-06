import {
	type DemandSource,
	assertSettled,
	monthWindow,
	releaseDemand,
	validateSuggestions,
} from "./demand-insights.policy";
const policy = { minBookers: 10, minHosts: 3, maxHostShare: 0.75 };
const source = (n = 10, hosts = 3): DemandSource[] =>
	Array.from({ length: n }, (_, i) => ({
		booking: `b${i}`,
		booker: `u${i}`,
		host: `h${i % hosts}`,
		tripType: "day_trip",
		difficulty: "easy",
	}));
describe("Booking demand privacy release", () => {
	it("blocks creation until the full configured delay after Vietnam month close", () => {
		const end = monthWindow("2026-10", new Date("2026-11-06T00:00:00Z")).end;
		expect(() => assertSettled(end, 3, new Date("2026-11-03T16:59:59.999Z"))).toThrow();
		expect(() => assertSettled(end, 3, new Date("2026-11-03T17:00:00Z"))).not.toThrow();
		expect(() => assertSettled(end, 7, new Date("2026-11-06T00:00:00Z"))).toThrow();
	});
	it("suppresses nine distinct bookers and accepts ten with three Hosts", () => {
		expect(releaseDemand(source(9), policy).cells).toEqual([]);
		expect(releaseDemand(source(), policy).cells).toEqual([
			{ tripType: "day_trip", difficulty: "easy", bookerBand: { min: 10, max: 19 } },
		]);
	});
	it("suppresses two Hosts even with ten bookers", () =>
		expect(releaseDemand(source(10, 2), policy).cells).toEqual([]));
	it("one booker cannot pass by making repeated Bookings with multiple Hosts", () =>
		expect(
			releaseDemand(
				source(30).map((r) => ({ ...r, booker: "same" })),
				policy
			).cells
		).toEqual([]));
	it("suppresses Host dominance above the configured fraction", () => {
		const rows = source();
		rows.forEach((r, i) => {
			r.host = i < 8 ? "dominant" : `h${i}`;
		});
		expect(releaseDemand(rows, policy).cells).toEqual([]);
	});
	it("does not count repeated bookers as extra contribution or extra cohort", () =>
		expect(releaseDemand([...source(), ...source()], policy)).toEqual(
			releaseDemand(source(), policy)
		));
	it("uses an approved custom stricter dominance threshold", () =>
		expect(releaseDemand(source(), { ...policy, maxHostShare: 0.35 }).cells).toEqual([]));
	it("coarsens the whole report only when no fine cells pass", () => {
		const rows = source().map((r, i) => ({ ...r, difficulty: i < 5 ? "easy" : "hard" }));
		expect(releaseDemand(rows, policy)).toEqual({
			granularity: "trip_type",
			cells: [{ tripType: "day_trip", difficulty: null, bookerBand: { min: 10, max: 19 } }],
		});
	});
	it("omits unsafe siblings without a total, other count or parent", () => {
		const result = releaseDemand(
			[...source(), ...source(2).map((r) => ({ ...r, tripType: "overnight" }))],
			policy
		);
		expect(result.cells).toHaveLength(1);
		expect(Object.keys(result).sort()).toEqual(["cells", "granularity"]);
		expect(JSON.stringify(result)).not.toMatch(/bookerId|hostId|booking|u0|h0|total/);
	});
	it("rechecks a frozen coarse report at its own granularity", () =>
		expect(releaseDemand(source(), policy, "trip_type").cells[0].difficulty).toBeNull());
	it.each([10, 11, 19, 20, 29, 30])("releases a band rather than the exact count for %i", (n) => {
		const band = releaseDemand(source(n), policy).cells[0].bookerBand;
		expect(band).toEqual({ min: Math.floor(n / 10) * 10, max: Math.floor(n / 10) * 10 + 9 });
	});
	it("ignores values outside the fixed taxonomy", () =>
		expect(
			releaseDemand(
				source().map((r) => ({ ...r, tripType: "publish_now" })),
				policy
			).cells
		).toEqual([]));
	it("uses adjacent non-overlapping Vietnam calendar months", () => {
		const now = new Date("2026-11-06T00:00:00Z");
		expect(monthWindow("2026-10", now).start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
		expect(monthWindow("2026-09", now).end).toEqual(monthWindow("2026-10", now).start);
	});
	it.each(["2026-11", "2026-12", "2025-10", "2026-13", "2026-1", "now", "2026-10-01"])(
		"rejects open/overlapping or invalid month %s",
		(month) => expect(() => monthWindow(month, new Date("2026-11-06T00:00:00Z"))).toThrow()
	);
	it("only accepts suggestions referencing released cells", () => {
		const cells = releaseDemand(source(), policy).cells;
		expect(
			validateSuggestions(
				{
					suggestions: [
						{ tripType: "day_trip", difficulty: "easy", reason: "observed_booking_interest" },
					],
				},
				cells
			)
		).toHaveLength(1);
		for (const bad of [
			{ tripType: "overnight", difficulty: "easy", reason: "observed_booking_interest" },
			{ tripType: "day_trip", difficulty: "easy", reason: "100 new bookings" },
			{ tripType: "day_trip", difficulty: "easy", reason: "observed_booking_interest", price: 100 },
		])
			expect(() => validateSuggestions({ suggestions: [bad] }, cells)).toThrow("invalid_output");
	});
	it("rejects numeric claims, prose, actions, duplicate candidates and extra output", () => {
		const cells = releaseDemand(source(), policy).cells;
		const one = { tripType: "day_trip", difficulty: "easy", reason: "advisory_not_forecast" };
		for (const raw of [
			null,
			{ suggestions: [] },
			{ suggestions: [one], summary: "100% demand" },
			{ suggestions: [one, one] },
		])
			expect(() => validateSuggestions(raw, cells)).toThrow("invalid_output");
	});
});
