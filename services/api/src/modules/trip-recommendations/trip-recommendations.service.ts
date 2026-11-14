import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	UnprocessableEntityException,
} from "@nestjs/common";
import { evaluateTripBookingEligibility } from "../bookings/trip-booking-eligibility";
import type { TripSummaryResponseDto } from "../trips/dto/trip-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripsRepository } from "../trips/repositories/trips.repository";
import { TripWeatherForecastStatus } from "../weather/entities/trip-weather-forecast.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { TripWeatherForecastService } from "../weather/services/trip-weather-forecast.service";
import {
	REGION_OPTIONS,
	type ReplaceTripPreferencesDto,
	type TripPreferencesResponseDto,
} from "./dto/trip-preferences.dto";
import type { TripRecommendationExplanationDto } from "./dto/trip-recommendation-explanation.dto";
import type {
	TripRecommendationItemDto,
	TripRecommendationsResponseDto,
} from "./dto/trip-recommendations-response.dto";
import type { RecommendationRunResult } from "./entities/trip-recommendation-run.entity";
import { buildExplanation } from "./trip-recommendation-explanation";
import {
	type CandidateFacts,
	type HistoryProfile,
	InvalidAiRankingError,
	MAX_AI_CANDIDATES,
	MAX_RECOMMENDATIONS,
	RECOMMENDATION_PROMPT_VERSION,
	RECOMMENDATION_RULES_VERSION,
	type RankedCandidate,
	type RecommendationFallbackReason,
	type RecommendationMode,
	type RecommendationSignalType,
	type ScoredCandidate,
	type TripPreferences,
	applyAiRanking,
	applyCachedRanking,
	applyHealthFit,
	defaultReasons,
	priceBand,
	scoreCandidates,
	signalFingerprint,
	signalTypeOf,
	summarizeHistory,
} from "./trip-recommendation.policy";
import {
	type AiRecommendationRequest,
	RecommendationAiError,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	TripRecommendationsProvider,
} from "./trip-recommendations.provider";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type CandidateRow,
	TripRecommendationsRepository,
} from "./trip-recommendations.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Bounds the final availability re-check to a few small batches. */
const MAX_CONFIRMATION_BATCHES = 4;

@Injectable()
export class TripRecommendationsService {
	private readonly logger = new Logger(TripRecommendationsService.name);
	private readonly pendingRankings = new Map<string, Promise<unknown>>();

	constructor(
		private readonly repository: TripRecommendationsRepository,
		private readonly provider: TripRecommendationsProvider,
		private readonly tripsRepository: TripsRepository,
		private readonly weatherRisk: RouteRegistrationRiskService,
		@Optional()
		@Inject(TripWeatherForecastService)
		private readonly tripWeatherForecasts?: TripWeatherForecastService
	) {}

	async getPreferences(userId: string): Promise<TripPreferencesResponseDto> {
		return { ...(await this.repository.findPreferences(userId)), regionOptions: REGION_OPTIONS };
	}

	async replacePreferences(
		userId: string,
		dto: ReplaceTripPreferencesDto
	): Promise<TripPreferencesResponseDto> {
		if (dto.minPrice !== null && dto.maxPrice !== null && dto.minPrice > dto.maxPrice) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [{ field: "minPrice", errors: ["minPrice must not exceed maxPrice"] }],
			});
		}
		const saved = await this.repository.replacePreferences(userId, {
			tripTypes: dto.tripTypes,
			difficulties: dto.difficulties,
			regions: dto.regions,
			minPrice: dto.minPrice,
			maxPrice: dto.maxPrice,
		});
		return { ...saved, regionOptions: REGION_OPTIONS };
	}

	/**
	 * Eligible Trips first (shared booking policy + trip-date weather policy), then the base score,
	 * then the AI order when available. Reading never changes a Trip, a seat or a price, and a
	 * suggestion holds nothing: the booking transaction re-checks everything under its locks.
	 */
	async getRecommendations(userId: string): Promise<TripRecommendationsResponseDto> {
		const startedAt = Date.now();
		const now = new Date();
		const [preferences, historyTrips, health] = await Promise.all([
			this.repository.findPreferences(userId),
			this.repository.findHistoryTrips(userId),
			this.repository.findHealthSignal(userId),
		]);
		const history = summarizeHistory(historyTrips);
		const signal = signalTypeOf(preferences, history);
		// Without any preference or booking history there is nothing to personalize: the Camper is
		// asked to choose preferences first instead of receiving a generic list.
		if (signal === "none") {
			return { status: "needs_preferences", items: [], generatedAt: now, mode: null };
		}
		const rows = await this.repository.findCandidateRows(userId);
		const eligible = await this.filterEligible(rows, now);
		const scored = scoreCandidates(eligible, preferences, history, now);
		const shortlist = scored.slice(0, MAX_AI_CANDIDATES);

		let mode: RecommendationMode = "rules";
		let fallbackReason: RecommendationFallbackReason | null = null;
		let modelVersion: string | null = null;
		let promptVersion: string | null = null;
		let ranked: RankedCandidate[] | null = null;
		let fingerprint: string | null = null;
		let aiRanking: RecommendationRunResult[] | null = null;
		let reusedRunId: string | null = null;
		let sentToAi = 0;

		if (shortlist.length > 0) {
			modelVersion = this.provider.modelVersion();
			if (!modelVersion) {
				fallbackReason = "ai_not_configured";
			} else {
				promptVersion = RECOMMENDATION_PROMPT_VERSION;
				fingerprint = signalFingerprint(preferences, history, {
					provider: "gemini",
					model: modelVersion,
					prompt: promptVersion,
				});
				// Same preferences and history as an earlier AI run: reuse its order, no AI call.
				const reusable = await this.repository.findReusableAiRun(
					userId,
					fingerprint,
					new Date(now.getTime() - this.provider.cacheTtlMs())
				);
				if (reusable?.aiRanking) {
					ranked = applyCachedRanking(reusable.aiRanking, scored);
					reusedRunId = reusable.id;
					mode = "ai";
				}
			}
			if (modelVersion && !ranked) {
				const codes = new Map(
					shortlist.map((candidate, index) => [`c${String(index + 1).padStart(2, "0")}`, candidate])
				);
				sentToAi = codes.size;
				try {
					const request = this.buildAiRequest(
						modelVersion,
						signal,
						preferences,
						history,
						codes,
						now
					);
					const output = await this.rankOnce(userId, request);
					ranked = applyAiRanking(output, codes, scored);
					const aiCount = (output as { ranking: unknown[] }).ranking.length;
					aiRanking = ranked.slice(0, aiCount).map((item) => ({
						tripId: item.candidate.facts.tripId,
						reasons: item.reasons,
					}));
					mode = "ai";
				} catch (error) {
					fallbackReason =
						error instanceof RecommendationAiError
							? error.reason
							: error instanceof InvalidAiRankingError
								? "ai_invalid_output"
								: "ai_unavailable";
					this.logger.warn(`Trip recommendation AI fallback: ${fallbackReason}`);
				}
			}
		}
		// Health fit is applied last, on the server only: the AI and its cache never see it, so a
		// health profile change shows on the next generation without another AI call.
		const ordered = applyHealthFit(
			ranked ?? scored.map((candidate) => ({ candidate, reasons: defaultReasons(candidate) })),
			health
		);
		const items = await this.confirmAvailability(userId, ordered);
		const latencyMs = Date.now() - startedAt;

		await this.repository.recordRun({
			userId,
			generatedAt: now,
			mode,
			signalType: signal,
			rulesVersion: RECOMMENDATION_RULES_VERSION,
			promptVersion,
			modelVersion: modelVersion ? `gemini/${modelVersion}` : null,
			eligibleCount: eligible.length,
			candidateCount: shortlist.length,
			results: items.map((item) => ({ tripId: item.trip.id, reasons: item.reasons })),
			fallbackReason,
			latencyMs,
			signalFingerprint: fingerprint,
			aiRanking,
			reusedRunId,
		});
		// Structured line for the existing log pipeline: latency and fallback rate per generation.
		this.logger.log(
			JSON.stringify({
				event: "trip_recommendations.generated",
				mode,
				signal,
				fallbackReason,
				healthConsidered: health !== null,
				eligibleCount: eligible.length,
				candidateCount: shortlist.length,
				resultCount: items.length,
				aiCalled: sentToAi > 0,
				reusedAiOrder: reusedRunId !== null,
				latencyMs,
			})
		);
		return { status: "ready", items, generatedAt: now, mode };
	}

	/**
	 * "Vì sao gợi ý chuyến này" for a Trip from the Camper's latest generation. Facts are re-read
	 * now, so seats, price and the Camper's current preferences and fitness are what is explained.
	 */
	async getExplanation(userId: string, tripId: string): Promise<TripRecommendationExplanationDto> {
		const latest = await this.repository.findLatestRun(userId);
		const shown = latest?.results.find((result) => result.tripId === tripId);
		const trip = shown ? await this.repository.findExplanationTrip(userId, tripId) : null;
		if (!latest || !shown || !trip) {
			throw new NotFoundException("Chuyến đi này không nằm trong gợi ý gần nhất của bạn.");
		}
		const [preferences, historyTrips, profile] = await Promise.all([
			this.repository.findPreferences(userId),
			this.repository.findHistoryTrips(userId),
			this.repository.findExplanationProfile(userId),
		]);
		const { sections, summary } = buildExplanation({
			trip,
			preferences,
			history: summarizeHistory(historyTrips),
			profile,
			now: new Date(),
		});
		return {
			tripTitle: trip.title,
			reasons: shown.reasons,
			sections,
			summary,
			healthConsidered: profile.health !== null,
			generatedAt: latest.generatedAt,
		};
	}

	/** Share only identical in-flight payloads for the same Camper; never reuse another profile. */
	private async rankOnce(userId: string, request: AiRecommendationRequest): Promise<unknown> {
		const key = JSON.stringify([userId, request]);
		const pending = this.pendingRankings.get(key);
		if (pending) return pending;
		const operation = this.provider.rank(request);
		this.pendingRankings.set(key, operation);
		try {
			return await operation;
		} finally {
			this.pendingRankings.delete(key);
		}
	}

	private async filterEligible(rows: CandidateRow[], now: Date): Promise<CandidateFacts[]> {
		const open = rows.filter((row) => evaluateTripBookingEligibility(row, 1, now) === null);
		const weather = await this.weatherRisk.evaluateBookingWeatherForTrips(
			open.map((row) => ({
				id: row.tripId,
				routeId: row.routeId,
				startsAt: row.startsAt,
				endsAt: row.endsAt,
			})),
			undefined,
			now
		);
		return open.filter((row) => weather.get(row.tripId) === "allowed");
	}

	/**
	 * Re-checks the final order against fresh data (seats can go, a Trip can be paused or turn Red
	 * while the AI ranks), refreshing each shortlisted Trip's own-date forecast the way the booking
	 * flow does, and backfills from the next ranked Trips.
	 */
	private async confirmAvailability(
		userId: string,
		ordered: RankedCandidate[]
	): Promise<TripRecommendationItemDto[]> {
		const accepted: TripRecommendationItemDto[] = [];
		for (
			let offset = 0, batch = 0;
			offset < ordered.length &&
			accepted.length < MAX_RECOMMENDATIONS &&
			batch < MAX_CONFIRMATION_BATCHES;
			offset += MAX_RECOMMENDATIONS, batch++
		) {
			const slice = ordered.slice(offset, offset + MAX_RECOMMENDATIONS);
			const ids = slice.map((item) => item.candidate.facts.tripId);
			const forecasts = new Map(
				await Promise.all(
					ids.map(
						async (id) =>
							[id, (await this.tripWeatherForecasts?.tryEnsureTripForecast(id)) ?? null] as const
					)
				)
			);
			const fresh = await this.filterEligible(
				await this.repository.findCandidateRows(userId, ids),
				new Date()
			);
			const stillEligible = new Set(fresh.map((facts) => facts.tripId));
			const summaries = new Map(
				(
					await this.tripsRepository.findPublishedSummariesByIds(
						ids.filter((id) => stillEligible.has(id))
					)
				).map((summary) => [summary.id, summary])
			);
			for (const item of slice) {
				const summary = summaries.get(item.candidate.facts.tripId);
				if (!summary || accepted.length >= MAX_RECOMMENDATIONS) continue;
				accepted.push({
					trip: this.withTripDateWeather(summary, forecasts.get(summary.id) ?? null),
					reasons: item.reasons,
				});
			}
		}
		return accepted;
	}

	/** Same badge as the search list: the forecast for the Trip's own dates, never Route weather. */
	private withTripDateWeather(
		summary: TripSummaryResponseDto,
		forecast: Awaited<ReturnType<TripWeatherForecastService["tryEnsureTripForecast"]>>
	): TripSummaryResponseDto {
		if (!this.tripWeatherForecasts) return summary;
		return {
			...summary,
			weatherRiskLevel:
				forecast?.status === TripWeatherForecastStatus.AVAILABLE ? forecast.riskLevel : null,
			weatherForecastStatus: forecast?.status ?? "unavailable",
		};
	}

	private buildAiRequest(
		model: string,
		signal: Exclude<RecommendationSignalType, "none">,
		preferences: TripPreferences,
		history: HistoryProfile,
		codes: ReadonlyMap<string, ScoredCandidate>,
		now: Date
	): AiRecommendationRequest {
		return {
			prompt_version: RECOMMENDATION_PROMPT_VERSION,
			model,
			signal,
			preferences: {
				tripTypes: preferences.tripTypes,
				difficulties: preferences.difficulties,
				regions: preferences.regions,
				hasPriceRange: preferences.minPrice !== null || preferences.maxPrice !== null,
			},
			history: {
				bookingCount: history.bookingCount,
				tripType: history.tripType,
				difficulty: history.difficulty,
				region: history.region,
				priceBand: history.priceBand,
			},
			candidates: [...codes].map(([code, candidate]) => ({
				code,
				tripType: candidate.facts.tripType,
				difficulty: candidate.facts.difficulty,
				region: candidate.facts.region,
				priceBand: priceBand(candidate.facts.pricePerPerson),
				durationNights: candidate.facts.durationNights,
				daysUntilStart: Math.max(
					0,
					Math.floor((candidate.facts.startsAt.getTime() - now.getTime()) / DAY_MS)
				),
				baseScore: candidate.score,
				allowedReasons: candidate.supportedReasons,
			})),
		};
	}
}
