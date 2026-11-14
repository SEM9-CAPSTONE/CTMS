import { FitnessLevel } from "../profiles/entities/health-profile.entity";
import {
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import type { TripSummaryResponseDto } from "../trips/dto/trip-response.dto";
import { TripStatus, TripType } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { TripRecommendationRun } from "./entities/trip-recommendation-run.entity";
import {
	EMPTY_PREFERENCES,
	type HealthSignal,
	type HistoryTripFacts,
	type TripPreferences,
} from "./trip-recommendation.policy";
import {
	type AiRecommendationRequest,
	RecommendationAiError,
	type TripRecommendationsProvider,
} from "./trip-recommendations.provider";
import type {
	CandidateRow,
	TripRecommendationsRepository,
} from "./trip-recommendations.repository";
import { TripRecommendationsService } from "./trip-recommendations.service";

const DAY = 86_400_000;
const USER = "11111111-1111-4111-8111-111111111111";
const tripId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function row(n: number, overrides: Partial<CandidateRow> = {}): CandidateRow {
	return {
		tripId: tripId(n),
		routeId: `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
		status: TripStatus.PUBLISHED,
		routeStatus: TrekkingRouteStatus.ACTIVE,
		tripType: n % 2 === 0 ? TripType.OVERNIGHT : TripType.DAY_TRIP,
		difficulty: TrekkingRouteDifficulty.MODERATE,
		region: "son_tra",
		pricePerPerson: 800_000,
		durationNights: n % 2 === 0 ? 1 : 0,
		bookingDeadline: new Date(Date.now() + (n + 1) * DAY),
		// Half a day off the day boundary, so "days until start" never flips between two calls.
		startsAt: new Date(Date.now() + (n + 2) * DAY + DAY / 2),
		endsAt: new Date(Date.now() + (n + 2) * DAY + DAY / 2 + 8 * 3_600_000),
		capacityMax: 10,
		seatsTaken: 2,
		weatherPausedAt: null,
		publishedAt: new Date("2026-10-01T00:00:00.000Z"),
		routeLengthMeters: 6_000,
		routeDurationMinutes: 180,
		...overrides,
	};
}

function summary(id: string): TripSummaryResponseDto {
	return { id, title: `Chuyến ${id.slice(-2)}`, weatherRiskLevel: null } as TripSummaryResponseDto;
}

interface Setup {
	rows?: CandidateRow[];
	freshRows?: (ids: string[]) => CandidateRow[];
	preferences?: TripPreferences;
	history?: HistoryTripFacts[];
	model?: string | null;
	rank?: (request: AiRecommendationRequest) => Promise<unknown>;
	blockedWeather?: string[];
	health?: HealthSignal | null;
}

function setup(options: Setup = {}) {
	const rows = options.rows ?? [row(1), row(2), row(3)];
	const runs: Array<Omit<TripRecommendationRun, "id">> = [];
	// Default: a price range every fixture Trip matches, so the Camper has a signal.
	const state = {
		preferences: options.preferences ?? { ...EMPTY_PREFERENCES, maxPrice: 5_000_000 },
		health: options.health ?? null,
	};
	const repository = {
		findPreferences: jest.fn(async () => ({ ...state.preferences, updatedAt: null })),
		findHistoryTrips: jest.fn(async () => options.history ?? []),
		findHealthSignal: jest.fn(async () => state.health),
		findLatestRun: jest.fn(async () => {
			const last = runs.at(-1);
			return last ? { results: last.results, generatedAt: last.generatedAt } : null;
		}),
		findExplanationTrip: jest.fn(async (_user: string, id: string) => {
			const found = rows.find((r) => r.tripId === id);
			return found
				? { ...found, title: "Khám phá bán đảo Sơn Trà", description: null, heldByCamper: false }
				: null;
		}),
		findExplanationProfile: jest.fn(async () => ({
			bio: null,
			dateOfBirth: null,
			experienceYears: null,
			experienceDetails: null,
			health: state.health
				? {
						fitnessLevel: state.health.fitnessLevel,
						allergies: [],
						medicalConditions: [],
						dietaryRestrictions: null,
					}
				: null,
		})),
		findCandidateRows: jest.fn(async (_user: string, ids?: string[]) =>
			ids ? (options.freshRows?.(ids) ?? rows.filter((r) => ids.includes(r.tripId))) : rows
		),
		recordRun: jest.fn(async (run: Omit<TripRecommendationRun, "id">) => {
			runs.push(run);
		}),
		// Mirrors the SQL: latest run with the same fingerprint that stored an AI order.
		findReusableAiRun: jest.fn(async (_user: string, fingerprint: string, since: Date) => {
			const index = runs.findLastIndex(
				(run) =>
					run.signalFingerprint === fingerprint &&
					run.aiRanking !== null &&
					run.generatedAt >= since
			);
			return index < 0 ? null : { id: `run-${index}`, aiRanking: runs[index].aiRanking };
		}),
	};
	const provider = {
		modelVersion: jest.fn(() => (options.model === undefined ? "gpt-test" : options.model)),
		cacheTtlMs: jest.fn(() => 24 * 3_600_000),
		rank: jest.fn(options.rank ?? (async () => ({ ranking: [] }))),
	};
	const trips = {
		findPublishedSummariesByIds: jest.fn(async (ids: string[]) => ids.map(summary)),
	};
	const weather = {
		evaluateBookingWeatherForTrips: jest.fn(
			async (list: Array<{ id: string }>) =>
				new Map(
					list.map((t) => [t.id, options.blockedWeather?.includes(t.id) ? "blocked" : "allowed"])
				)
		),
	};
	const service = new TripRecommendationsService(
		repository as unknown as TripRecommendationsRepository,
		provider as unknown as TripRecommendationsProvider,
		trips as unknown as TripsRepository,
		weather as unknown as RouteRegistrationRiskService
	);
	return { service, repository, provider, trips, weather, runs, state };
}

const overnightPreference: TripPreferences = {
	...EMPTY_PREFERENCES,
	tripTypes: [TripType.OVERNIGHT],
};

describe("TripRecommendationsService", () => {
	it("asks a Camper without preferences or history to choose preferences first", async () => {
		const { service, provider, repository, runs } = setup({ preferences: EMPTY_PREFERENCES });
		const result = await service.getRecommendations(USER);
		expect(result).toMatchObject({ status: "needs_preferences", items: [], mode: null });
		expect(repository.findCandidateRows).not.toHaveBeenCalled();
		expect(provider.rank).not.toHaveBeenCalled();
		expect(runs).toEqual([]);
	});

	it("does not ask for preferences when booking history is enough", async () => {
		const { service } = setup({
			preferences: EMPTY_PREFERENCES,
			model: null,
			history: [
				{
					tripType: TripType.OVERNIGHT,
					difficulty: TrekkingRouteDifficulty.MODERATE,
					region: "son_tra",
					pricePerPerson: 800_000,
				},
			],
		});
		const result = await service.getRecommendations(USER);
		expect(result.status).toBe("ready");
		expect(result.items[0].trip.id).toBe(tripId(2));
	});

	it("drops every Trip the booking rules or the trip-date weather policy would refuse", async () => {
		const rows = [
			row(1),
			row(2, { seatsTaken: 10 }),
			row(3, { weatherPausedAt: new Date() }),
			row(4, { routeStatus: TrekkingRouteStatus.CLOSED }),
			row(5, { bookingDeadline: new Date(Date.now() - 1) }),
			row(6),
		];
		const { service, weather } = setup({ rows, blockedWeather: [tripId(6)] });
		const result = await service.getRecommendations(USER);
		expect(result.items.map((item) => item.trip.id)).toEqual([tripId(1)]);
		// Weather is only evaluated for Trips that passed the booking rules.
		expect(
			weather.evaluateBookingWeatherForTrips.mock.calls[0][0].map((t: { id: string }) => t.id)
		).toEqual([tripId(1), tripId(6)]);
	});

	it("sends only temporary codes and structured attributes to the AI and keeps its order", async () => {
		let sent: AiRecommendationRequest | null = null;
		const { service, runs } = setup({
			preferences: overnightPreference,
			history: [
				{
					tripType: TripType.DAY_TRIP,
					difficulty: TrekkingRouteDifficulty.EASY,
					region: "hai_van_lien_chieu",
					pricePerPerson: 500_000,
				},
			],
			rank: async (request) => {
				sent = request;
				return {
					ranking: [
						{ code: "c03", reasons: [] },
						{ code: "c01", reasons: ["preferred_trip_type"] },
					],
				};
			},
		});
		const result = await service.getRecommendations(USER);
		expect(result.mode).toBe("ai");
		expect(sent).not.toBeNull();
		const payload = JSON.stringify(sent);
		for (const forbidden of [USER, tripId(1), tripId(2), tripId(3), "Chuyến", "routeId"]) {
			expect(payload).not.toContain(forbidden);
		}
		expect(payload).not.toMatch(
			/health|sos|gps|latitude|longitude|password|token|payment|email|phone|booking(Id)?"/i
		);
		const request = sent as unknown as AiRecommendationRequest;
		expect(request.candidates.map((c) => c.code)).toEqual(["c01", "c02", "c03"]);
		expect(Object.keys(request.candidates[0]).sort()).toEqual(
			[
				"allowedReasons",
				"baseScore",
				"code",
				"daysUntilStart",
				"difficulty",
				"durationNights",
				"priceBand",
				"region",
				"tripType",
			].sort()
		);
		expect(request.history.bookingCount).toBe(1);
		// Base order puts the overnight Trip (2) first; the AI moved c03 (Trip 3) to the top.
		const base = request.candidates.map((c) => c.code);
		expect(base[0]).toBe("c01");
		expect(result.items.map((item) => item.trip.id)).toEqual([tripId(3), tripId(2), tripId(1)]);
		expect(result.items[1].reasons).toEqual(["preferred_trip_type"]);
		expect(runs[0]).toMatchObject({
			mode: "ai",
			signalType: "preferences_and_history",
			promptVersion: "trip-recommendation-v1",
			modelVersion: "gemini/gpt-test",
			fallbackReason: null,
			candidateCount: 3,
		});
		expect(runs[0].results.map((r) => r.tripId)).toEqual([tripId(3), tripId(2), tripId(1)]);
	});

	it("never sends more than 30 candidates", async () => {
		const rows = Array.from({ length: 40 }, (_, i) => row(i + 1));
		let count = 0;
		const { service } = setup({
			rows,
			preferences: overnightPreference,
			rank: async (request) => {
				count = request.candidates.length;
				throw new RecommendationAiError("ai_unavailable");
			},
		});
		const result = await service.getRecommendations(USER);
		expect(count).toBe(30);
		expect(result.items).toHaveLength(6);
	});

	it.each([
		["timeout", async () => Promise.reject(new RecommendationAiError("ai_timeout")), "ai_timeout"],
		[
			"service error",
			async () => Promise.reject(new RecommendationAiError("ai_unavailable")),
			"ai_unavailable",
		],
		[
			"unknown code",
			async () => ({ ranking: [{ code: "c99", reasons: [] }] }),
			"ai_invalid_output",
		],
		[
			"duplicate code",
			async () => ({
				ranking: [
					{ code: "c01", reasons: [] },
					{ code: "c01", reasons: [] },
				],
			}),
			"ai_invalid_output",
		],
		[
			"reason without basis",
			async () => ({ ranking: [{ code: "c02", reasons: ["preferred_region"] }] }),
			"ai_invalid_output",
		],
		["malformed body", async () => "not json", "ai_invalid_output"],
	] as const)("falls back to the full base order on %s", async (_label, rank, reason) => {
		const { service, runs } = setup({ preferences: overnightPreference, rank });
		const result = await service.getRecommendations(USER);
		expect(result.mode).toBe("rules");
		// Overnight Trip 2 matches the preference, then the rest by departure.
		expect(result.items.map((item) => item.trip.id)).toEqual([tripId(2), tripId(1), tripId(3)]);
		expect(result.items[0].reasons).toEqual(["preferred_trip_type", "departing_soon"]);
		expect(runs[0]).toMatchObject({
			mode: "rules",
			fallbackReason: reason,
			promptVersion: "trip-recommendation-v1",
		});
	});

	it("records a missing AI configuration as a fallback without calling it", async () => {
		const { service, provider, runs } = setup({ preferences: overnightPreference, model: null });
		const result = await service.getRecommendations(USER);
		expect(provider.rank).not.toHaveBeenCalled();
		expect(result.mode).toBe("rules");
		expect(runs[0]).toMatchObject({ fallbackReason: "ai_not_configured", modelVersion: null });
	});

	it("re-checks after ranking: a Trip that filled up meanwhile is replaced by the next one", async () => {
		const rows = Array.from({ length: 8 }, (_, i) => row(i + 1));
		const { service } = setup({
			rows,
			preferences: overnightPreference,
			rank: async () => ({ ranking: [{ code: "c01", reasons: [] }] }),
			freshRows: (ids) =>
				rows
					.filter((r) => ids.includes(r.tripId))
					.map((r) => (r.tripId === tripId(2) ? { ...r, seatsTaken: 10 } : r)),
		});
		const result = await service.getRecommendations(USER);
		const ids = result.items.map((item) => item.trip.id);
		expect(ids).toHaveLength(6);
		expect(ids).not.toContain(tripId(2));
		// Base order 2,4,6,8,1,3,5,7; Trip 5 from the next batch fills the freed slot.
		expect(ids).toEqual([tripId(4), tripId(6), tripId(8), tripId(1), tripId(3), tripId(5)]);
	});

	it("returns an empty list when nothing is eligible", async () => {
		const { service, provider, runs } = setup({
			rows: [row(1, { seatsTaken: 10 })],
			preferences: overnightPreference,
		});
		const result = await service.getRecommendations(USER);
		expect(result.items).toEqual([]);
		expect(provider.rank).not.toHaveBeenCalled();
		expect(runs[0]).toMatchObject({ eligibleCount: 0, candidateCount: 0, fallbackReason: null });
	});

	it("propagates infrastructure errors instead of returning an empty list", async () => {
		const { service, repository } = setup();
		repository.findCandidateRows.mockRejectedValueOnce(new Error("connection refused"));
		await expect(service.getRecommendations(USER)).rejects.toThrow("connection refused");
	});

	it("reuses the AI order while preferences and history are unchanged", async () => {
		const rank = jest.fn(async () => ({
			ranking: [
				{ code: "c03", reasons: [] },
				{ code: "c01", reasons: ["preferred_trip_type"] },
			],
		}));
		const { service, provider, runs, state } = setup({ preferences: overnightPreference, rank });
		const first = await service.getRecommendations(USER);
		const second = await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(1);
		expect(second.mode).toBe("ai");
		expect(second.items.map((item) => item.trip.id)).toEqual(
			first.items.map((item) => item.trip.id)
		);
		expect(runs[0].aiRanking?.map((r) => r.tripId)).toEqual([tripId(3), tripId(2)]);
		expect(runs[1]).toMatchObject({ reusedRunId: "run-0", aiRanking: null, mode: "ai" });
		expect(runs[1].signalFingerprint).toBe(runs[0].signalFingerprint);

		// Saving the same choices again is not a profile change.
		state.preferences = { ...overnightPreference, tripTypes: [TripType.OVERNIGHT] };
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(1);

		// A real change calls the AI again.
		state.preferences = { ...overnightPreference, maxPrice: 1_000_000 };
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(2);
	});

	it("calls the AI again when the booking history changes", async () => {
		const history: HistoryTripFacts[] = [];
		const { service, provider, repository } = setup({
			preferences: overnightPreference,
			rank: async () => ({ ranking: [{ code: "c01", reasons: [] }] }),
		});
		repository.findHistoryTrips.mockImplementation(async () => history);
		await service.getRecommendations(USER);
		history.push({
			tripType: TripType.DAY_TRIP,
			difficulty: TrekkingRouteDifficulty.EASY,
			region: "son_tra",
			pricePerPerson: 400_000,
		});
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(2);
	});

	it("coalesces concurrent rankings and still revalidates each response", async () => {
		let finish!: (output: unknown) => void;
		const pending = new Promise<unknown>((resolve) => {
			finish = resolve;
		});
		const { service, provider, repository } = setup({ rank: () => pending });
		const first = service.getRecommendations(USER);
		const second = service.getRecommendations(USER);
		// Allow both callers to reach the shared pending provider operation.
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(provider.rank).toHaveBeenCalledTimes(1);
		finish({ ranking: [{ code: "c01", reasons: [] }] });
		const results = await Promise.all([first, second]);
		expect(results.map((result) => result.mode)).toEqual(["ai", "ai"]);
		expect(repository.findCandidateRows.mock.calls.filter((args) => args[1])).toHaveLength(2);
	});

	it("invalidates the cached order when the model changes", async () => {
		const { service, provider, runs } = setup({
			rank: async () => ({ ranking: [{ code: "c01", reasons: [] }] }),
		});
		await service.getRecommendations(USER);
		provider.modelVersion.mockReturnValue("gemini-other");
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(2);
		expect(runs[0].signalFingerprint).not.toBe(runs[1].signalFingerprint);
	});

	it("drops Trips that became ineligible from a reused order and adds new ones in base order", async () => {
		const rows = [row(1), row(2), row(3)];
		const { service, provider, repository } = setup({
			rows,
			preferences: overnightPreference,
			rank: async () => ({
				ranking: [
					{ code: "c03", reasons: [] },
					{ code: "c02", reasons: [] },
					{ code: "c01", reasons: [] },
				],
			}),
		});
		await service.getRecommendations(USER);
		const later = [row(1), row(2, { seatsTaken: 10 }), row(3), row(4)];
		repository.findCandidateRows.mockImplementation(async (_u: string, ids?: string[]) =>
			ids ? later.filter((r) => ids.includes(r.tripId)) : later
		);
		const result = await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(1);
		// Stored order 3, (2 full), 1; Trip 4 was published afterwards and follows in base order.
		expect(result.items.map((item) => item.trip.id)).toEqual([tripId(3), tripId(1), tripId(4)]);
	});

	it("does not cache a fallback, so the next request tries the AI again", async () => {
		const { service, provider } = setup({
			preferences: overnightPreference,
			rank: async () => {
				throw new RecommendationAiError("ai_timeout");
			},
		});
		await service.getRecommendations(USER);
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(2);
	});

	it("calls the AI again once the stored order is older than the cache window", async () => {
		const { service, provider } = setup({
			preferences: overnightPreference,
			rank: async () => ({ ranking: [{ code: "c01", reasons: [] }] }),
		});
		provider.cacheTtlMs.mockReturnValue(-1);
		await service.getRecommendations(USER);
		await service.getRecommendations(USER);
		expect(provider.rank).toHaveBeenCalledTimes(2);
	});

	it("rejects a price range whose minimum exceeds its maximum", async () => {
		const { service } = setup();
		await expect(
			service.replacePreferences(USER, {
				tripTypes: [],
				difficulties: [],
				regions: [],
				minPrice: 2_000_000,
				maxPrice: 1_000_000,
			})
		).rejects.toMatchObject({ status: 422 });
	});

	describe("health fit (server only)", () => {
		const beginner: HealthSignal = {
			fitnessLevel: FitnessLevel.BEGINNER,
			hasMedicalConditions: false,
		};
		const rowsByDifficulty = () => [
			row(1, { difficulty: TrekkingRouteDifficulty.EXPERT }),
			row(2, { difficulty: TrekkingRouteDifficulty.EASY }),
			row(3, { difficulty: TrekkingRouteDifficulty.MODERATE }),
		];

		it("moves Trips far beyond the Camper's fitness behind the others and never sends health to the AI", async () => {
			const requests: AiRecommendationRequest[] = [];
			const { service } = setup({
				rows: rowsByDifficulty(),
				health: beginner,
				rank: async (request) => {
					requests.push(request);
					return { ranking: [{ code: "c01", reasons: [] }] };
				},
			});
			const result = await service.getRecommendations(USER);
			expect(result.items.map((item) => item.trip.id)).toEqual([tripId(2), tripId(3), tripId(1)]);
			expect(result.items[0].reasons[0]).toBe("fitness_match");
			const sent = JSON.stringify(requests);
			expect(sent).not.toMatch(/fitness|BEGINNER|medical|health/i);
			for (const candidate of requests[0].candidates) {
				expect(candidate.allowedReasons).not.toContain("fitness_match");
			}
		});

		it("applies a changed fitness level immediately while reusing the cached AI order", async () => {
			const { service, provider, state } = setup({
				rows: rowsByDifficulty(),
				rank: async () => ({
					ranking: [
						{ code: "c01", reasons: [] },
						{ code: "c02", reasons: [] },
						{ code: "c03", reasons: [] },
					],
				}),
			});
			const first = await service.getRecommendations(USER);
			expect(first.items[0].trip.id).toBe(tripId(1));
			state.health = beginner;
			const second = await service.getRecommendations(USER);
			expect(provider.rank).toHaveBeenCalledTimes(1);
			expect(second.items.at(-1)?.trip.id).toBe(tripId(1));
		});

		it("ignores health entirely without consent", async () => {
			const { service } = setup({ rows: rowsByDifficulty(), model: null, health: null });
			const result = await service.getRecommendations(USER);
			expect(result.items.flatMap((item) => item.reasons)).not.toContain("fitness_match");
		});
	});

	describe("getExplanation", () => {
		it("explains a Trip from the latest suggestions in Vietnamese without ids", async () => {
			const { service } = setup({
				model: null,
				health: { fitnessLevel: FitnessLevel.INTERMEDIATE, hasMedicalConditions: false },
			});
			await service.getRecommendations(USER);
			const explanation = await service.getExplanation(USER, tripId(2));
			expect(explanation.tripTitle).toBe("Khám phá bán đảo Sơn Trà");
			expect(explanation.healthConsidered).toBe(true);
			expect(explanation.sections.map((section) => section.kind)).toEqual(
				expect.arrayContaining(["fitness", "price", "timing"])
			);
			expect(explanation.summary).toMatch(/^Vì vậy chuyến này phù hợp với bạn về /);
			expect(JSON.stringify(explanation.sections)).not.toContain(tripId(2).slice(0, 8));
		});

		it("returns 404 for a Trip that was not suggested, or before any suggestion", async () => {
			const { service } = setup({ rows: [row(1)], model: null });
			await expect(service.getExplanation(USER, tripId(1))).rejects.toMatchObject({ status: 404 });
			await service.getRecommendations(USER);
			await expect(service.getExplanation(USER, tripId(9))).rejects.toMatchObject({ status: 404 });
		});
	});
});
