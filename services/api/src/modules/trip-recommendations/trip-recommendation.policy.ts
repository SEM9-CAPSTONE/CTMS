import { createHash } from "node:crypto";
import type { FitnessLevel } from "../profiles/entities/health-profile.entity";
import type { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import type { TripType } from "../trips/entities/trip.entity";
import type { TripRegionCode } from "./trip-regions";

export const RECOMMENDATION_RULES_VERSION = "trip-recommendation-rules-v2";
export const RECOMMENDATION_PROMPT_VERSION = "trip-recommendation-v1";
export const MAX_RECOMMENDATIONS = 6;
export const MAX_AI_CANDIDATES = 30;
export const HISTORY_BOOKING_LIMIT = 20;
export const HISTORY_MONTHS = 12;
export const MAX_REASONS_PER_TRIP = 2;
/** A history share below this is too weak to be shown as "similar to what you booked". */
export const HISTORY_REASON_MIN_SHARE = 0.25;
const DEPARTING_SOON_MS = 14 * 24 * 60 * 60 * 1000;

export type RecommendationMode = "ai" | "rules";
export type RecommendationSignalType =
	| "none"
	| "preferences"
	| "history"
	| "preferences_and_history";
export type RecommendationFallbackReason =
	| "ai_not_configured"
	| "ai_timeout"
	| "ai_unavailable"
	| "ai_invalid_output";

export const RECOMMENDATION_REASONS = [
	"preferred_trip_type",
	"preferred_difficulty",
	"preferred_region",
	"preferred_price",
	"booked_trip_type",
	"booked_difficulty",
	"booked_region",
	"booked_price",
	"departing_soon",
	// Added on the server after ranking from the consented health profile; never sent to the AI.
	"fitness_match",
] as const;
export type RecommendationReason = (typeof RECOMMENDATION_REASONS)[number];

export type PriceBand = "under_500k" | "500k_1500k" | "1500k_3000k" | "over_3000k";

export function priceBand(pricePerPerson: number): PriceBand {
	if (pricePerPerson < 500_000) return "under_500k";
	if (pricePerPerson < 1_500_000) return "500k_1500k";
	if (pricePerPerson < 3_000_000) return "1500k_3000k";
	return "over_3000k";
}

export interface TripPreferences {
	tripTypes: TripType[];
	difficulties: TrekkingRouteDifficulty[];
	regions: TripRegionCode[];
	minPrice: number | null;
	maxPrice: number | null;
}

export const EMPTY_PREFERENCES: TripPreferences = {
	tripTypes: [],
	difficulties: [],
	regions: [],
	minPrice: null,
	maxPrice: null,
};

/** Structured attributes of an eligible Trip; no title, description or Host data. */
export interface CandidateFacts {
	tripId: string;
	tripType: TripType;
	difficulty: TrekkingRouteDifficulty | null;
	region: TripRegionCode | null;
	pricePerPerson: number;
	durationNights: number;
	startsAt: Date;
	publishedAt: Date;
	routeLengthMeters: number | null;
	routeDurationMinutes: number | null;
}

/** Attributes of one past confirmed/completed booking's Trip; nothing about the booking itself. */
export interface HistoryTripFacts {
	tripType: TripType;
	difficulty: TrekkingRouteDifficulty | null;
	region: TripRegionCode | null;
	pricePerPerson: number;
}

type Shares<K extends string> = Partial<Record<K, number>>;

/** Aggregated history: only proportions per attribute value plus the number of bookings used. */
export interface HistoryProfile {
	bookingCount: number;
	tripType: Shares<TripType>;
	difficulty: Shares<TrekkingRouteDifficulty>;
	region: Shares<TripRegionCode>;
	priceBand: Shares<PriceBand>;
}

function shares<K extends string>(values: Array<K | null>): Shares<K> {
	const result: Shares<K> = {};
	if (values.length === 0) return result;
	for (const value of values) {
		if (value !== null) result[value] = (result[value] ?? 0) + 1;
	}
	for (const key of Object.keys(result) as K[]) {
		result[key] = Math.round(((result[key] ?? 0) / values.length) * 1000) / 1000;
	}
	return result;
}

export function summarizeHistory(trips: HistoryTripFacts[]): HistoryProfile {
	const used = trips.slice(0, HISTORY_BOOKING_LIMIT);
	return {
		bookingCount: used.length,
		tripType: shares(used.map((trip) => trip.tripType)),
		difficulty: shares(used.map((trip) => trip.difficulty)),
		region: shares(used.map((trip) => trip.region)),
		priceBand: shares(used.map((trip) => priceBand(trip.pricePerPerson))),
	};
}

export function hasPreferenceSignal(preferences: TripPreferences): boolean {
	return (
		preferences.tripTypes.length > 0 ||
		preferences.difficulties.length > 0 ||
		preferences.regions.length > 0 ||
		preferences.minPrice !== null ||
		preferences.maxPrice !== null
	);
}

export function signalTypeOf(
	preferences: TripPreferences,
	history: HistoryProfile
): RecommendationSignalType {
	const fromPreferences = hasPreferenceSignal(preferences);
	const fromHistory = history.bookingCount > 0;
	if (fromPreferences && fromHistory) return "preferences_and_history";
	if (fromPreferences) return "preferences";
	if (fromHistory) return "history";
	return "none";
}

export interface ScoredCandidate {
	facts: CandidateFacts;
	/** 0..1; the four groups are weighted equally. */
	score: number;
	/** Every reason the facts support, strongest first. */
	supportedReasons: RecommendationReason[];
}

interface GroupResult {
	score: number;
	reason: RecommendationReason | null;
	fromPreference: boolean;
}

function groupScore<V extends string>(
	value: V | null,
	preferred: readonly V[],
	historyShares: Shares<V>,
	hasHistory: boolean,
	preferenceReason: RecommendationReason,
	historyReason: RecommendationReason
): GroupResult {
	if (preferred.length > 0) {
		const match = value !== null && preferred.includes(value);
		return { score: match ? 1 : 0, reason: match ? preferenceReason : null, fromPreference: true };
	}
	if (!hasHistory || value === null) return { score: 0, reason: null, fromPreference: false };
	const share = historyShares[value] ?? 0;
	return {
		score: share,
		reason: share >= HISTORY_REASON_MIN_SHARE ? historyReason : null,
		fromPreference: false,
	};
}

function priceGroupScore(
	price: number,
	preferences: TripPreferences,
	history: HistoryProfile
): GroupResult {
	if (preferences.minPrice !== null || preferences.maxPrice !== null) {
		const match =
			(preferences.minPrice === null || price >= preferences.minPrice) &&
			(preferences.maxPrice === null || price <= preferences.maxPrice);
		return { score: match ? 1 : 0, reason: match ? "preferred_price" : null, fromPreference: true };
	}
	return groupScore(
		priceBand(price),
		[],
		history.priceBand,
		history.bookingCount > 0,
		"preferred_price",
		"booked_price"
	);
}

/**
 * Base (rule) score. Within each group a chosen preference wins; otherwise the share of that value
 * in the booking history is used; with neither the group contributes nothing. Ties, including the
 * case where no group matches, are broken by nearest departure then earliest publication.
 */
export function scoreCandidates(
	candidates: CandidateFacts[],
	preferences: TripPreferences,
	history: HistoryProfile,
	now: Date
): ScoredCandidate[] {
	const hasHistory = history.bookingCount > 0;
	return candidates
		.map((facts) => {
			const groups = [
				groupScore(
					facts.tripType,
					preferences.tripTypes,
					history.tripType,
					hasHistory,
					"preferred_trip_type",
					"booked_trip_type"
				),
				groupScore(
					facts.difficulty,
					preferences.difficulties,
					history.difficulty,
					hasHistory,
					"preferred_difficulty",
					"booked_difficulty"
				),
				groupScore(
					facts.region,
					preferences.regions,
					history.region,
					hasHistory,
					"preferred_region",
					"booked_region"
				),
				priceGroupScore(facts.pricePerPerson, preferences, history),
			];
			const supportedReasons = groups
				.filter((group): group is GroupResult & { reason: RecommendationReason } =>
					Boolean(group.reason)
				)
				.sort((a, b) => Number(b.fromPreference) - Number(a.fromPreference) || b.score - a.score)
				.map((group) => group.reason);
			if (facts.startsAt.getTime() - now.getTime() <= DEPARTING_SOON_MS) {
				supportedReasons.push("departing_soon");
			}
			const score = groups.reduce((sum, group) => sum + group.score, 0) / groups.length;
			return { facts, score: Math.round(score * 1000) / 1000, supportedReasons };
		})
		.sort(compareScored);
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
	return (
		b.score - a.score ||
		a.facts.startsAt.getTime() - b.facts.startsAt.getTime() ||
		a.facts.publishedAt.getTime() - b.facts.publishedAt.getTime() ||
		a.facts.tripId.localeCompare(b.facts.tripId)
	);
}

export function defaultReasons(candidate: ScoredCandidate): RecommendationReason[] {
	return candidate.supportedReasons.slice(0, MAX_REASONS_PER_TRIP);
}

export interface RankedCandidate {
	candidate: ScoredCandidate;
	reasons: RecommendationReason[];
}

export class InvalidAiRankingError extends Error {
	constructor(detail: string) {
		super(`Invalid AI ranking: ${detail}`);
		this.name = "InvalidAiRankingError";
	}
}

/**
 * Validates the AI output against the candidates that were sent. Any unknown or repeated code, an
 * unknown reason, or a reason the candidate's facts do not support invalidates the whole ranking
 * (the caller then uses the base order). Candidates the AI leaves out keep their base order after
 * the ranked ones, so later eligibility drops can still be backfilled.
 */
export function applyAiRanking(
	output: unknown,
	candidatesByCode: ReadonlyMap<string, ScoredCandidate>,
	baseOrder: readonly ScoredCandidate[]
): RankedCandidate[] {
	if (!output || typeof output !== "object" || Array.isArray(output)) {
		throw new InvalidAiRankingError("not an object");
	}
	const keys = Object.keys(output);
	if (keys.length !== 1 || keys[0] !== "ranking")
		throw new InvalidAiRankingError("unexpected keys");
	const ranking = (output as { ranking: unknown }).ranking;
	if (!Array.isArray(ranking) || ranking.length === 0 || ranking.length > candidatesByCode.size) {
		throw new InvalidAiRankingError("ranking size");
	}
	const seen = new Set<string>();
	const ranked: RankedCandidate[] = [];
	for (const entry of ranking) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			throw new InvalidAiRankingError("entry shape");
		}
		const { code, reasons, ...rest } = entry as Record<string, unknown>;
		if (Object.keys(rest).length > 0) throw new InvalidAiRankingError("entry keys");
		if (typeof code !== "string") throw new InvalidAiRankingError("code type");
		const candidate = candidatesByCode.get(code);
		if (!candidate) throw new InvalidAiRankingError("unknown code");
		if (seen.has(code)) throw new InvalidAiRankingError("duplicate code");
		seen.add(code);
		if (!Array.isArray(reasons) || reasons.length > MAX_REASONS_PER_TRIP) {
			throw new InvalidAiRankingError("reasons shape");
		}
		if (new Set(reasons).size !== reasons.length)
			throw new InvalidAiRankingError("duplicate reason");
		for (const reason of reasons) {
			if (!candidate.supportedReasons.includes(reason as RecommendationReason)) {
				throw new InvalidAiRankingError("unsupported reason");
			}
		}
		ranked.push({
			candidate,
			reasons: reasons.length > 0 ? (reasons as RecommendationReason[]) : defaultReasons(candidate),
		});
	}
	const rankedIds = new Set(ranked.map((item) => item.candidate.facts.tripId));
	for (const candidate of baseOrder) {
		if (!rankedIds.has(candidate.facts.tripId)) {
			ranked.push({ candidate, reasons: defaultReasons(candidate) });
		}
	}
	return ranked;
}

function sortedRecord(record: Record<string, number | undefined>): Array<[string, number]> {
	return Object.entries(record)
		.filter((entry): entry is [string, number] => entry[1] !== undefined)
		.sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Fingerprint of everything about the Camper the AI ranks on: chosen preferences, aggregated
 * history (it changes when a booking is confirmed or completed) and the rule/prompt/model versions.
 * Saving identical preferences again keeps the same fingerprint.
 */
export function signalFingerprint(
	preferences: TripPreferences,
	history: HistoryProfile,
	versions: { model: string; prompt: string; provider?: string }
): string {
	const payload = {
		provider: versions.provider ?? "gemini",
		rules: RECOMMENDATION_RULES_VERSION,
		prompt: versions.prompt,
		model: versions.model,
		preferences: {
			tripTypes: [...preferences.tripTypes].sort(),
			difficulties: [...preferences.difficulties].sort(),
			regions: [...preferences.regions].sort(),
			minPrice: preferences.minPrice,
			maxPrice: preferences.maxPrice,
		},
		history: {
			bookingCount: history.bookingCount,
			tripType: sortedRecord(history.tripType),
			difficulty: sortedRecord(history.difficulty),
			region: sortedRecord(history.region),
			priceBand: sortedRecord(history.priceBand),
		},
	};
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Re-applies a stored AI order to today's eligible Trips. Trips that are no longer eligible drop
 * out; stored reasons are kept only while today's facts still support them; Trips published
 * after that AI run follow in base order.
 */
export function applyCachedRanking(
	cached: ReadonlyArray<{ tripId: string; reasons: readonly string[] }>,
	baseOrder: readonly ScoredCandidate[]
): RankedCandidate[] {
	const byId = new Map(baseOrder.map((candidate) => [candidate.facts.tripId, candidate]));
	const ranked: RankedCandidate[] = [];
	const used = new Set<string>();
	for (const entry of cached) {
		const candidate = byId.get(entry.tripId);
		if (!candidate || used.has(entry.tripId)) continue;
		used.add(entry.tripId);
		const reasons = entry.reasons.filter((reason): reason is RecommendationReason =>
			candidate.supportedReasons.includes(reason as RecommendationReason)
		);
		ranked.push({ candidate, reasons: reasons.length > 0 ? reasons : defaultReasons(candidate) });
	}
	for (const candidate of baseOrder) {
		if (!used.has(candidate.facts.tripId)) {
			ranked.push({ candidate, reasons: defaultReasons(candidate) });
		}
	}
	return ranked;
}

/**
 * The only health facts recommendations use, and only when the Camper consented to share their
 * health profile. Allergies, notes and condition names are never read. Stays on the server.
 */
export interface HealthSignal {
	fitnessLevel: FitnessLevel;
	hasMedicalConditions: boolean;
}

export type FitnessFit = "good" | "stretch" | "too_hard";

/** Keyed by the enum string values (easy … expert, BEGINNER … EXPERT). */
const DIFFICULTY_LEVEL: Readonly<Record<string, number>> = {
	easy: 0,
	moderate: 1,
	hard: 2,
	expert: 3,
};
const FITNESS_CEILING: Readonly<Record<string, number>> = {
	BEGINNER: 0,
	INTERMEDIATE: 1,
	ADVANCED: 2,
	EXPERT: 3,
};
/** A Route longer or slower than this counts one difficulty step harder. */
export const LONG_ROUTE_METERS = 15_000;
export const LONG_ROUTE_MINUTES = 8 * 60;

export function isLongRoute(lengthMeters: number | null, durationMinutes: number | null): boolean {
	return (
		(lengthMeters !== null && lengthMeters > LONG_ROUTE_METERS) ||
		(durationMinutes !== null && durationMinutes > LONG_ROUTE_MINUTES)
	);
}

/** How a Trip's effort compares with the Camper's self-declared fitness; null when unknown. */
export function fitnessFit(
	fitnessLevel: FitnessLevel,
	difficulty: TrekkingRouteDifficulty | null,
	lengthMeters: number | null,
	durationMinutes: number | null
): FitnessFit | null {
	if (difficulty === null) return null;
	const effort =
		(DIFFICULTY_LEVEL[difficulty] ?? 0) + (isLongRoute(lengthMeters, durationMinutes) ? 1 : 0);
	const over = effort - (FITNESS_CEILING[fitnessLevel] ?? 0);
	if (over <= 0) return "good";
	return over === 1 ? "stretch" : "too_hard";
}

/**
 * Applied after the AI (or cached, or rule) order so no health fact reaches the AI: Trips well
 * beyond the Camper's fitness move behind the others (never removed), and Trips that suit it lead
 * with "Phù hợp thể lực của bạn". Recomputed on every generation, so a health profile change shows
 * immediately without asking the AI again.
 */
export function applyHealthFit(
	ranked: readonly RankedCandidate[],
	health: HealthSignal | null
): RankedCandidate[] {
	if (!health) return [...ranked];
	const suitable: RankedCandidate[] = [];
	const tooHard: RankedCandidate[] = [];
	for (const item of ranked) {
		const { facts } = item.candidate;
		const fit = fitnessFit(
			health.fitnessLevel,
			facts.difficulty,
			facts.routeLengthMeters,
			facts.routeDurationMinutes
		);
		if (fit === "too_hard") {
			tooHard.push(item);
		} else if (fit === "good") {
			suitable.push({
				candidate: item.candidate,
				reasons: [
					"fitness_match",
					...item.reasons.filter((reason) => reason !== "fitness_match"),
				].slice(0, MAX_REASONS_PER_TRIP) as RecommendationReason[],
			});
		} else {
			suitable.push(item);
		}
	}
	return [...suitable, ...tooHard];
}
