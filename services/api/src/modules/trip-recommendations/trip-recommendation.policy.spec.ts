import { FitnessLevel } from "../profiles/entities/health-profile.entity";
import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import { TripType } from "../trips/entities/trip.entity";
import {
	type CandidateFacts,
	EMPTY_PREFERENCES,
	InvalidAiRankingError,
	type RecommendationReason,
	type TripPreferences,
	applyAiRanking,
	applyHealthFit,
	fitnessFit,
	scoreCandidates,
	signalFingerprint,
	signalTypeOf,
	summarizeHistory,
} from "./trip-recommendation.policy";

const now = new Date("2026-11-14T00:00:00.000Z");
const day = 86_400_000;
let counter = 0;
const trip = (overrides: Partial<CandidateFacts> = {}): CandidateFacts => {
	counter += 1;
	return {
		tripId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
		tripType: TripType.DAY_TRIP,
		difficulty: TrekkingRouteDifficulty.EASY,
		region: "son_tra",
		pricePerPerson: 600_000,
		durationNights: 0,
		startsAt: new Date(now.getTime() + 30 * day),
		publishedAt: new Date("2026-10-01T00:00:00.000Z"),
		routeLengthMeters: 5_000,
		routeDurationMinutes: 150,
		...overrides,
	};
};
const noHistory = summarizeHistory([]);
const prefs = (overrides: Partial<TripPreferences>): TripPreferences => ({
	...EMPTY_PREFERENCES,
	...overrides,
});

describe("signalTypeOf", () => {
	it("distinguishes new Campers, preferences only, history only and both", () => {
		const history = summarizeHistory([
			{ tripType: TripType.OVERNIGHT, difficulty: null, region: null, pricePerPerson: 1 },
		]);
		expect(signalTypeOf(EMPTY_PREFERENCES, noHistory)).toBe("none");
		expect(signalTypeOf(prefs({ maxPrice: 1 }), noHistory)).toBe("preferences");
		expect(signalTypeOf(EMPTY_PREFERENCES, history)).toBe("history");
		expect(signalTypeOf(prefs({ regions: ["hai_van_lien_chieu"] }), history)).toBe(
			"preferences_and_history"
		);
	});

	it("uses at most 20 history bookings", () => {
		const many = Array.from({ length: 25 }, () => ({
			tripType: TripType.DAY_TRIP,
			difficulty: null,
			region: null,
			pricePerPerson: 1,
		}));
		expect(summarizeHistory(many).bookingCount).toBe(20);
	});
});

describe("scoreCandidates", () => {
	it("orders a neutral list by departure, then publication", () => {
		const late = trip({ startsAt: new Date(now.getTime() + 20 * day) });
		const earlyLater = trip({
			startsAt: new Date(now.getTime() + 5 * day),
			publishedAt: new Date("2026-10-05T00:00:00.000Z"),
		});
		const earlyFirst = trip({
			startsAt: new Date(now.getTime() + 5 * day),
			publishedAt: new Date("2026-10-02T00:00:00.000Z"),
		});
		const scored = scoreCandidates(
			[late, earlyLater, earlyFirst],
			EMPTY_PREFERENCES,
			noHistory,
			now
		);
		expect(scored.map((item) => item.facts.tripId)).toEqual([
			earlyFirst.tripId,
			earlyLater.tripId,
			late.tripId,
		]);
		expect(scored.every((item) => item.score === 0)).toBe(true);
		expect(scored[0].supportedReasons).toEqual(["departing_soon"]);
		expect(scored[2].supportedReasons).toEqual([]);
	});

	it("weights the four groups equally and uses a chosen preference over history", () => {
		const match = trip({
			tripType: TripType.OVERNIGHT,
			difficulty: TrekkingRouteDifficulty.HARD,
			region: "ba_na_hoa_vang",
			pricePerPerson: 2_000_000,
		});
		const partial = trip({ tripType: TripType.OVERNIGHT });
		const history = summarizeHistory([
			{ tripType: TripType.DAY_TRIP, difficulty: null, region: null, pricePerPerson: 600_000 },
		]);
		const scored = scoreCandidates(
			[partial, match],
			prefs({
				tripTypes: [TripType.OVERNIGHT],
				difficulties: [TrekkingRouteDifficulty.HARD],
				regions: ["ba_na_hoa_vang"],
				minPrice: 1_500_000,
				maxPrice: 2_500_000,
			}),
			history,
			now
		);
		expect(scored[0].facts.tripId).toBe(match.tripId);
		expect(scored[0].score).toBe(0.8);
		expect(scored[0].supportedReasons).toEqual([
			"preferred_trip_type",
			"preferred_difficulty",
			"preferred_region",
			"preferred_price",
		]);
		// Only the trip type matches; history about day trips is ignored once a type is chosen.
		expect(scored[1].score).toBe(0.2);
		expect(scored[1].supportedReasons).toEqual(["preferred_trip_type"]);
	});

	it("falls back per group to history shares", () => {
		const history = summarizeHistory([
			{
				tripType: TripType.OVERNIGHT,
				difficulty: TrekkingRouteDifficulty.HARD,
				region: "hai_van_lien_chieu",
				pricePerPerson: 2_000_000,
			},
			{
				tripType: TripType.OVERNIGHT,
				difficulty: TrekkingRouteDifficulty.EASY,
				region: "hai_van_lien_chieu",
				pricePerPerson: 2_100_000,
			},
			{
				tripType: TripType.DAY_TRIP,
				difficulty: TrekkingRouteDifficulty.EASY,
				region: null,
				pricePerPerson: 300_000,
			},
			{
				tripType: TripType.OVERNIGHT,
				difficulty: TrekkingRouteDifficulty.EASY,
				region: "hai_van_lien_chieu",
				pricePerPerson: 2_500_000,
			},
		]);
		expect(history.tripType).toEqual({ overnight: 0.75, day_trip: 0.25 });
		const similar = trip({
			tripType: TripType.OVERNIGHT,
			difficulty: TrekkingRouteDifficulty.HARD,
			region: "hai_van_lien_chieu",
			pricePerPerson: 1_800_000,
		});
		const different = trip({ difficulty: TrekkingRouteDifficulty.EXPERT, region: "ngu_hanh_son" });
		const scored = scoreCandidates(
			[different, similar],
			prefs({ regions: ["ngu_hanh_son"] }),
			history,
			now
		);
		const bySimilar = scored.find((item) => item.facts.tripId === similar.tripId);
		const byDifferent = scored.find((item) => item.facts.tripId === different.tripId);
		// overnight 0.75 + hard 0.25 + preferred region missed 0 + price band 0.75 = 1.75 / 4
		expect(bySimilar?.score).toBe(0.35);
		expect(bySimilar?.supportedReasons).toEqual([
			"booked_trip_type",
			"booked_price",
			"booked_difficulty",
		]);
		// day trip 0.25 + expert 0 + preferred region 1 + band 0 = 1.25 / 4
		expect(byDifferent?.score).toBe(0.25);
		expect(byDifferent?.supportedReasons[0]).toBe("preferred_region");
	});

	it("changes order when the preferences change", () => {
		const dayTrip = trip({ tripType: TripType.DAY_TRIP });
		const overnight = trip({ tripType: TripType.OVERNIGHT });
		const first = scoreCandidates(
			[dayTrip, overnight],
			prefs({ tripTypes: [TripType.DAY_TRIP] }),
			noHistory,
			now
		);
		const second = scoreCandidates(
			[dayTrip, overnight],
			prefs({ tripTypes: [TripType.OVERNIGHT] }),
			noHistory,
			now
		);
		expect(first[0].facts.tripId).toBe(dayTrip.tripId);
		expect(second[0].facts.tripId).toBe(overnight.tripId);
	});
});

describe("applyAiRanking", () => {
	const a = trip({ tripType: TripType.OVERNIGHT });
	const b = trip();
	const c = trip();
	const scored = scoreCandidates(
		[a, b, c],
		prefs({ tripTypes: [TripType.OVERNIGHT] }),
		noHistory,
		now
	);
	const byCode = new Map([
		["c01", scored[0]],
		["c02", scored[1]],
	]);

	it("keeps the AI order, backfills the rest in base order, and defaults empty reasons", () => {
		const ranked = applyAiRanking(
			{
				ranking: [
					{ code: "c02", reasons: [] },
					{ code: "c01", reasons: ["preferred_trip_type"] },
				],
			},
			byCode,
			scored
		);
		expect(ranked.map((item) => item.candidate.facts.tripId)).toEqual([
			scored[1].facts.tripId,
			scored[0].facts.tripId,
			scored[2].facts.tripId,
		]);
		expect(ranked[1].reasons).toEqual(["preferred_trip_type"]);
	});

	it.each([
		["unknown code", { ranking: [{ code: "c99", reasons: [] }] }],
		["real trip id", { ranking: [{ code: a.tripId, reasons: [] }] }],
		[
			"duplicate code",
			{
				ranking: [
					{ code: "c01", reasons: [] },
					{ code: "c01", reasons: [] },
				],
			},
		],
		["unknown reason", { ranking: [{ code: "c01", reasons: ["best_trip_ever"] }] }],
		["unsupported reason", { ranking: [{ code: "c02", reasons: ["preferred_trip_type"] }] }],
		[
			"duplicate reason",
			{ ranking: [{ code: "c01", reasons: ["preferred_trip_type", "preferred_trip_type"] }] },
		],
		["free text field", { ranking: [{ code: "c01", reasons: [], note: "Rất đẹp" }] }],
		["extra top-level key", { ranking: [{ code: "c01", reasons: [] }], summary: "x" }],
		["empty ranking", { ranking: [] }],
		["not an object", "c01,c02"],
	])("rejects %s", (_label, output) => {
		expect(() => applyAiRanking(output, byCode, scored)).toThrow(InvalidAiRankingError);
	});
});

describe("fitnessFit", () => {
	const { EASY, MODERATE, HARD, EXPERT } = TrekkingRouteDifficulty;
	it.each([
		[FitnessLevel.BEGINNER, EASY, "good"],
		[FitnessLevel.BEGINNER, MODERATE, "stretch"],
		[FitnessLevel.BEGINNER, HARD, "too_hard"],
		[FitnessLevel.INTERMEDIATE, MODERATE, "good"],
		[FitnessLevel.INTERMEDIATE, HARD, "stretch"],
		[FitnessLevel.INTERMEDIATE, EXPERT, "too_hard"],
		[FitnessLevel.ADVANCED, HARD, "good"],
		[FitnessLevel.EXPERT, EXPERT, "good"],
	])("%s on %s is %s", (level, difficulty, expected) => {
		expect(fitnessFit(level, difficulty, 5_000, 120)).toBe(expected);
	});

	it("counts a long or slow Route one step harder", () => {
		expect(fitnessFit(FitnessLevel.INTERMEDIATE, MODERATE, 18_000, 120)).toBe("stretch");
		expect(fitnessFit(FitnessLevel.INTERMEDIATE, MODERATE, 5_000, 9 * 60)).toBe("stretch");
	});

	it("is unknown without a difficulty", () => {
		expect(fitnessFit(FitnessLevel.BEGINNER, null, null, null)).toBeNull();
	});
});

describe("applyHealthFit", () => {
	const ranked = () => {
		const hard = trip({ difficulty: TrekkingRouteDifficulty.EXPERT });
		const easy = trip({ difficulty: TrekkingRouteDifficulty.EASY });
		const reasons: RecommendationReason[] = ["preferred_price", "preferred_region"];
		return [hard, easy].map((facts) => ({
			candidate: { facts, score: 1, supportedReasons: [] },
			reasons: [...reasons],
		}));
	};

	it("keeps the order without a consented health signal", () => {
		const items = ranked();
		expect(applyHealthFit(items, null)).toEqual(items);
	});

	it("demotes too-hard Trips without removing them and caps reasons at two", () => {
		const items = ranked();
		const result = applyHealthFit(items, {
			fitnessLevel: FitnessLevel.BEGINNER,
			hasMedicalConditions: false,
			activityProfile: {
				comfortableDistanceKm: 10,
				comfortableWalkingMinutes: 300,
				activityNotes: null,
				confirmedAt: now.toISOString(),
			},
		});
		expect(result.map((item) => item.candidate.facts.tripId)).toEqual([
			items[1].candidate.facts.tripId,
			items[0].candidate.facts.tripId,
		]);
		expect(result[0].reasons).toEqual(["fitness_match", "preferred_price"]);
		expect(result[1].reasons).toEqual(["preferred_price", "preferred_region"]);
	});
});

describe("structured profile signals", () => {
	it("scores declared activities and experience without changing hard eligibility", () => {
		const a = trip({ activities: ["camping"], difficulty: TrekkingRouteDifficulty.EASY });
		const b = trip({ activities: [], difficulty: TrekkingRouteDifficulty.HARD });
		const choices = prefs({
			tripTypes: [TripType.DAY_TRIP],
			activities: ["camping", "photography"],
			experienceYears: 0,
		});
		const scores = scoreCandidates([b, a], choices, noHistory, now);
		expect(scores[0].facts.tripId).toBe(a.tripId);
		expect(scores[0].score).toBe(0.325);
		expect(scores[0].supportedReasons).toContain("preferred_activity");
		expect(scores[0].supportedReasons).toContain("declared_experience_match");
		expect(scores[1].supportedReasons).not.toContain("declared_experience_match");
	});
	it("treats missing activities and experience as unknown", () => {
		const result = scoreCandidates([trip()], prefs({ activities: ["camping"] }), noHistory, now)[0];
		expect(result.score).toBe(0);
		expect(result.supportedReasons).not.toContain("preferred_activity");
		expect(result.supportedReasons).not.toContain("declared_experience_match");
		expect(signalTypeOf(prefs({ activities: ["camping"] }), noHistory)).toBe("preferences");
	});
	it("invalidates cache when candidate facts, selected activities or experience change", () => {
		const a = trip();
		const choices = prefs({ activities: ["camping"], experienceYears: 0 });
		const key = (facts: CandidateFacts, preferences = choices) =>
			signalFingerprint(preferences, noHistory, {
				model: "model",
				prompt: "v2",
				candidates: scoreCandidates([facts], preferences, noHistory, now),
				now,
			});
		const original = key(a);
		expect(key({ ...a })).toBe(original);
		for (const changed of [
			{ ...a, pricePerPerson: a.pricePerPerson + 1 },
			{ ...a, difficulty: TrekkingRouteDifficulty.HARD },
			{ ...a, activities: ["camping"] },
		])
			expect(key(changed)).not.toBe(original);
		expect(key(a, { ...choices, experienceYears: 3 })).not.toBe(original);
		expect(key(a, { ...choices, activities: ["forest"] })).not.toBe(original);
	});
});

it("separates bookings from proven participation and completion", () => {
	const facts = {
		tripType: TripType.DAY_TRIP,
		difficulty: TrekkingRouteDifficulty.EASY,
		region: null,
		pricePerPerson: 1,
	};
	const history = summarizeHistory([
		{ ...facts, participation: "booked" },
		{ ...facts, participation: "joined" },
		{ ...facts, participation: "completed" },
	]);
	expect(history).toMatchObject({ bookingCount: 3, participatedCount: 2, completedCount: 1 });
});
