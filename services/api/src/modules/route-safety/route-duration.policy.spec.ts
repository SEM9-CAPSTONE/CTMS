import { estimateRouteDuration } from "./route-duration.policy";

describe("TCVN 14602 route duration", () => {
	it("returns 265 minutes for 10 km moderate, 300 m up and 200 m down", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 10_000, terrain: "MODERATE" }], 300, 200)
		).toMatchObject({
			horizontalMinutes: 200,
			verticalMinutes: 130,
			estimatedMinutes: 265,
			minimumMinutes: 265,
			estimateBasis: "TCVN",
		});
	});
	it("sums the horizontal time of mixed terrain legs before combining with vertical time", () => {
		const result = estimateRouteDuration(
			[
				{ distanceMeters: 4000, terrain: "EASY" },
				{ distanceMeters: 3000, terrain: "MODERATE" },
				{ distanceMeters: 2000, terrain: "HARD" },
			],
			200,
			300
		);
		expect(result).toMatchObject({
			horizontalMinutes: 180,
			verticalMinutes: 120,
			estimatedMinutes: 240,
		});
	});
	it("halves the horizontal component when the vertical component is larger", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 4000, terrain: "EASY" }], 400, 300)
		).toMatchObject({
			horizontalMinutes: 60,
			verticalMinutes: 180,
			estimatedMinutes: 210,
		});
	});
	it("does not add extra time on a flat route or automatically double for a return trip", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 10_000, terrain: "MODERATE" }], 0, 0)
				.estimatedMinutes
		).toBe(200);
	});
	it("does not treat missing elevations as a confirmed flat route", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 10_000, terrain: "MODERATE" }], null, null)
		).toMatchObject({
			verticalMinutes: null,
			estimateBasis: "DISTANCE_ONLY",
			minimumMinutes: 150,
		});
	});
	it("uses unknown terrain as a distance floor rather than declaring it easy", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 10_000, terrain: "UNKNOWN" }], 300, 200)
		).toMatchObject({
			estimatedMinutes: 215,
			minimumMinutes: 150,
			estimateBasis: "PARTIAL",
			unknownDistanceMeters: 10_000,
		});
	});
	it("does not enforce a complete estimate when elevation sampling is sparse", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 10_000, terrain: "MODERATE" }], 300, 200, false)
		).toMatchObject({
			estimatedMinutes: 265,
			minimumMinutes: 150,
			estimateBasis: "PARTIAL",
		});
	});
	it("rounds up only at the end without floating-point off-by-one errors", () => {
		expect(
			estimateRouteDuration([{ distanceMeters: 1000, terrain: "MODERATE" }], 3, 0).estimatedMinutes
		).toBe(21);
	});
});
