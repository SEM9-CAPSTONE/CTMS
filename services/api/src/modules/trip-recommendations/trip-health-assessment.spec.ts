import { FitnessLevel } from "../profiles/entities/health-profile.entity";
import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import { TripType } from "../trips/entities/trip.entity";
import { assessTripHealth, prioritizeHealth } from "./trip-health-assessment";
import type { CandidateFacts, HealthSignal, RankedCandidate } from "./trip-recommendation.policy";

const health: HealthSignal & { activityProfile: NonNullable<HealthSignal["activityProfile"]> } = {
	fitnessLevel: FitnessLevel.INTERMEDIATE,
	hasMedicalConditions: false,
	activityProfile: {
		comfortableDistanceKm: 5,
		comfortableWalkingMinutes: 180,
		activityNotes: null,
		confirmedAt: "2026-11-19T00:00:00Z",
	},
};
const trip = (overrides: Partial<CandidateFacts> = {}): CandidateFacts => ({
	tripId: "son-tra",
	tripType: TripType.DAY_TRIP,
	difficulty: TrekkingRouteDifficulty.EASY,
	region: "son_tra",
	pricePerPerson: 500000,
	durationNights: 0,
	startsAt: new Date("2026-12-20"),
	publishedAt: new Date("2026-11-19"),
	routeLengthMeters: 4000,
	routeDurationMinutes: 120,
	...overrides,
});
const ranked = (facts: CandidateFacts, score: number): RankedCandidate => ({
	candidate: { facts, score, supportedReasons: [] },
	reasons: ["preferred_price"],
});

describe("health-first Trip assessment", () => {
	it("compares the saved daily distance/time limits with actual Route requirements", () => {
		const result = assessTripHealth(
			trip({ routeLengthMeters: 12000, routeDurationMinutes: 300 }),
			health
		);
		expect(result.status).toBe("needs_review");
		expect(result.comparisons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ profileValue: "5 km", tripValue: "12 km", result: "caution" }),
				expect.objectContaining({
					profileValue: "180 phút",
					tripValue: "300 phút",
					result: "caution",
				}),
			])
		);
	});
	it("prioritizes a suitable Trip over an AI/preference favorite, while preserving order within each tier", () => {
		const result = prioritizeHealth(
			[
				ranked(trip({ tripId: "far", routeLengthMeters: 12000 }), 1),
				ranked(trip({ tripId: "near" }), 0),
				ranked(trip({ tripId: "second-near" }), 0),
			],
			health
		);
		expect(result.map((item) => item.candidate.facts.tripId)).toEqual([
			"near",
			"second-near",
			"far",
		]);
		expect(result[0].reasons).toContain("fitness_match");
		expect(result[2].reasons).not.toContain("fitness_match");
	});
	it("does not claim suitability for an existing profile with no declared activity data", () => {
		const result = assessTripHealth(trip(), { ...health, activityProfile: null });
		expect(result.status).toBe("insufficient_data");
		expect(result.missingInformation).toEqual(
			expect.arrayContaining([
				expect.stringContaining("quãng đường"),
				expect.stringContaining("thời gian"),
			])
		);
		expect(
			prioritizeHealth([ranked(trip(), 1)], { ...health, activityProfile: null })[0].reasons
		).not.toContain("fitness_match");
	});
	it("assesses saved activity without separate confirmation and still reports missing Route measurements", () => {
		const unconfirmed = {
			...health,
			activityProfile: { ...health.activityProfile, confirmedAt: null },
		};
		const result = assessTripHealth(trip({ routeLengthMeters: null }), unconfirmed);
		expect(assessTripHealth(trip(), unconfirmed).status).toBe("suitable");
		expect(result.status).toBe("insufficient_data");
		expect(result.missingInformation).toContain("Chuyến chưa có chiều dài cung đường.");
	});
	it("does not compare a multi-day Route total as if it were one day's walking", () => {
		const result = assessTripHealth(
			trip({ tripType: TripType.OVERNIGHT, durationNights: 2, routeLengthMeters: 12000 }),
			health
		);
		expect(result.status).toBe("insufficient_data");
		expect(result.comparisons.find((item) => item.label.includes("Quãng đường"))?.result).toBe(
			"unknown"
		);
	});

	it("distinguishes an explicitly declared zero capacity from missing information", () => {
		const result = assessTripHealth(trip(), {
			...health,
			activityProfile: {
				...health.activityProfile,
				comfortableDistanceKm: 0,
				comfortableWalkingMinutes: 0,
			},
		});
		expect(result.status).toBe("needs_review");
		expect(result.comparisons).toEqual(
			expect.arrayContaining([expect.objectContaining({ profileValue: "0 km", result: "caution" })])
		);
	});
	it.each(["hasMedicalConditions"] as const)(
		"requires confirmation for %s without declaring a medical contraindication",
		(flag) => {
			const result = assessTripHealth(trip(), { ...health, [flag]: true });
			expect(result.status).toBe("needs_review");
			expect(result.comparisons.some((item) => item.result === "caution")).toBe(true);
		}
	);
	it("ignores legacy allergy and diet flags when assessing and ranking Trips", () => {
		const legacyHealth = { ...health, hasAllergies: true, hasDietaryRestrictions: true };
		expect(assessTripHealth(trip(), legacyHealth)).toEqual(assessTripHealth(trip(), health));
		const candidates = [ranked(trip(), 1)];
		expect(prioritizeHealth(candidates, legacyHealth)).toEqual(
			prioritizeHealth(candidates, health)
		);
	});
	it("quotes actual limitations/advice and does not interpret their text as a diagnosis", () => {
		const result = assessTripHealth(trip(), {
			...health,
			activityProfile: {
				...health.activityProfile,
				activityNotes: "Khó đi xuống dốc dài\n\nTránh mang ba lô nặng",
			},
		});
		expect(result.status).toBe("needs_review");
		expect(result.comparisons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: "Lưu ý khi vận động",
					profileValue: "Khó đi xuống dốc dài\n\nTránh mang ba lô nặng",
				}),
			])
		);
	});
});
