import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	ServiceUnavailableException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import {
	type TripWeatherForecastResponseDto,
	toTripWeatherForecastResponse,
} from "../dto/trip-weather-forecast-response.dto";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
	type TripWeatherWorstReading,
} from "../entities/trip-weather-forecast.entity";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import {
	WEATHER_ADVICE_PROVIDER,
	type WeatherAdviceProvider,
} from "../providers/weather-advice-provider.interface";
import {
	WEATHER_FORECAST_HORIZON_DAYS,
	WEATHER_PROVIDER,
	type WeatherForecastHour,
	type WeatherProvider,
} from "../providers/weather-provider.interface";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type TripForWeatherForecast,
	TripWeatherForecastsRepository,
} from "../repositories/trip-weather-forecasts.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherChangeNotifier } from "./trip-weather-change-notifier.service";
import { scoreTemperature, scoreWeatherReading } from "./weather-risk-scoring";

const FORECASTABLE_TRIP_STATUSES = new Set(["draft", "pending_approval", "published"]);
/** Trips travellers can see and book or be on; ongoing Trips are forecast from the current hour. */
const TRAVELLER_VISIBLE_TRIP_STATUSES = new Set(["published", "ongoing"]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000];
const HOUR_MS = 60 * 60 * 1000;
/** Repeated requests within this window reuse the stored forecast instead of calling the provider. */
const REUSE_WINDOW_MS = 10 * 60 * 1000;
/** Newest history rows returned to clients. */
const HISTORY_LIMIT = 50;
/** Owning Host and Admin responses carry the AI opinion; traveller responses never do. */
const HOST_ADMIN_VIEW = { includeAiReview: true } as const;
/**
 * Raw provider responses are only kept while the Trip can still be submitted for approval, i.e. for
 * the forecast the Host may attach to the request (policy §4). Later checks keep the scored result.
 */
const RAW_RESPONSE_TRIP_STATUSES = new Set(["draft", "pending_approval"]);
/** Worst-hour values compared to decide whether a re-check changed the result. */
const WORST_READING_KEYS = [
	"rainfallMm",
	"windKph",
	"temperatureC",
	"visibilityM",
	"thunderstorm",
] as const;

@Injectable()
export class TripWeatherForecastService {
	private readonly logger = new Logger(TripWeatherForecastService.name);

	constructor(
		private readonly forecastsRepository: TripWeatherForecastsRepository,
		private readonly weatherRiskRepository: WeatherRiskRepository,
		@Inject(WEATHER_PROVIDER) private readonly weatherProvider: WeatherProvider,
		@Inject(WEATHER_ADVICE_PROVIDER) private readonly adviceProvider: WeatherAdviceProvider,
		@Optional() private readonly changeNotifier?: TripWeatherChangeNotifier
	) {}

	/** Forecasts the weather over the Trip's own schedule and scores its worst hours. */
	async forecastForTrip(
		actor: AuthenticatedUser,
		tripId: string,
		now: Date = new Date()
	): Promise<TripWeatherForecastResponseDto> {
		const trip = await this.loadAuthorizedTrip(actor, tripId);
		if (!FORECASTABLE_TRIP_STATUSES.has(trip.status)) {
			throw new ConflictException(
				"Weather can only be forecast for draft, pending or published Trips"
			);
		}
		const forecast = await this.computeForecast(trip, actor.userId, now);
		return toTripWeatherForecastResponse(forecast, WEATHER_FORECAST_HORIZON_DAYS, HOST_ADMIN_VIEW);
	}

	/**
	 * Forecast for the Trip's own dates as shown to travellers (Campers, Porters) before and after
	 * booking: a Trip on 10/11 is judged by the 10/11 forecast, never by today's weather.
	 * Unpublished Trips are indistinguishable from absent ones. Forecasts a traveller triggers are
	 * recorded under the Trip's Host, so they never pin a Camper or Porter account in place.
	 */
	async forecastForTravellers(
		tripId: string,
		now: Date = new Date()
	): Promise<TripWeatherForecastResponseDto> {
		const trip = await this.forecastsRepository.findTripForForecast(tripId);
		if (!trip || !TRAVELLER_VISIBLE_TRIP_STATUSES.has(trip.status)) {
			throw new NotFoundException("Trip not found");
		}
		const forecast = await this.computeForecast(trip, trip.hostId, now);
		return toTripWeatherForecastResponse(forecast, WEATHER_FORECAST_HORIZON_DAYS);
	}

	/**
	 * Best-effort fresh forecast for the Trip's dates, used before booking and for the packing list.
	 * Never throws: null means no trip-date forecast could be obtained (provider down, no rule, no
	 * Route); callers then decide their own fallback. Recorded under the Trip's Host, like
	 * forecastForTravellers.
	 */
	async tryEnsureTripForecast(
		tripId: string,
		now: Date = new Date()
	): Promise<TripWeatherForecast | null> {
		try {
			const trip = await this.forecastsRepository.findTripForForecast(tripId);
			if (!trip || !TRAVELLER_VISIBLE_TRIP_STATUSES.has(trip.status)) return null;
			return await this.computeForecast(trip, trip.hostId, now);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`No trip-date forecast for trip ${tripId}: ${message}`);
			return null;
		}
	}

	/** Shared computation: reuse a recent forecast for the same schedule, otherwise fetch and score. */
	private async computeForecast(
		trip: TripForWeatherForecast,
		actorId: string,
		now: Date
	): Promise<TripWeatherForecast> {
		const tripId = trip.id;
		if (!trip.routeId || !trip.centroid || !trip.startsAt || !trip.endsAt) {
			throw new UnprocessableEntityException("Trip Route and schedule are required for a forecast");
		}
		const startsAt = new Date(trip.startsAt);
		const endsAt = new Date(trip.endsAt);
		if (endsAt.getTime() <= now.getTime()) {
			throw new ConflictException("Trip has already ended");
		}

		const horizonEnd = forecastHorizonEnd(now);
		const outOfRange = startsAt.getTime() > horizonEnd.getTime();
		const activeRule = outOfRange ? null : await this.weatherRiskRepository.findActiveRule();
		if (!outOfRange && !activeRule) {
			throw new ConflictException("No active weather risk rules configured in the system.");
		}

		const latest = await this.forecastsRepository.findLatestForTrip(tripId);
		if (latest && this.isReusable(latest, startsAt, endsAt, activeRule, now)) {
			// An out-of-range result stays valid until the Trip enters the horizon; confirm it so the
			// monitoring job does not pick the Trip again on every run.
			return latest.status === TripWeatherForecastStatus.OUT_OF_RANGE
				? this.forecastsRepository.touchCheckedAt(latest, now)
				: latest;
		}

		if (outOfRange || !activeRule) {
			return this.forecastsRepository.save(
				this.forecastsRepository.create({
					tripId,
					routeId: trip.routeId,
					status: TripWeatherForecastStatus.OUT_OF_RANGE,
					tripStartsAt: startsAt,
					tripEndsAt: endsAt,
					createdBy: actorId,
					checkedAt: now,
				})
			);
		}

		const from = new Date(Math.max(startsAt.getTime(), floorToHour(now).getTime()));
		const to = new Date(Math.min(endsAt.getTime(), horizonEnd.getTime()));
		const [longitude, latitude] = trip.centroid;
		const forecast = await this.fetchWithRetry(tripId, latitude, longitude, from, to);
		const hours = forecast.hours.filter(
			(hour) =>
				hour.time.getTime() >= floorToHour(from).getTime() && hour.time.getTime() <= to.getTime()
		);
		if (hours.length === 0) {
			throw new ServiceUnavailableException(
				"Weather provider returned no forecast for the Trip schedule. Please try again."
			);
		}

		const worst = worstReading(hours, activeRule);
		const scored = scoreWeatherReading(
			{
				rainfallMm: worst.rainfallMm,
				windKph: worst.windKph,
				temperatureC: worst.temperatureC,
				visibilityM: worst.visibilityM,
				thunderstorm: worst.thunderstorm,
			},
			activeRule
		);

		// History only on change (policy §4): the same level and worst-hour values for the same
		// schedule and rule just confirm the stored row again.
		if (
			latest &&
			this.isSameResult(latest, startsAt, endsAt, activeRule.id, scored.riskLevel, worst)
		) {
			return this.forecastsRepository.touchCheckedAt(latest, now);
		}

		const previous = await this.forecastsRepository.findLatestAvailableForTrip(tripId);
		const saved = await this.forecastsRepository.save(
			this.forecastsRepository.create({
				tripId,
				routeId: trip.routeId,
				status: TripWeatherForecastStatus.AVAILABLE,
				tripStartsAt: startsAt,
				tripEndsAt: endsAt,
				forecastFrom: hours[0].time,
				forecastTo: hours[hours.length - 1].time,
				worstReading: worst,
				ruleVersionId: activeRule.id,
				riskLevel: scored.riskLevel,
				compositeScore: scored.compositeScore,
				criteriaScores: scored.criteriaScores,
				providerResponse: RAW_RESPONSE_TRIP_STATUSES.has(trip.status) ? forecast.raw : null,
				createdBy: actorId,
				checkedAt: now,
			})
		);
		await this.changeNotifier?.notifyIfLevelChanged(saved, previous?.riskLevel ?? null);
		return saved;
	}

	private isSameResult(
		latest: TripWeatherForecast,
		startsAt: Date,
		endsAt: Date,
		ruleId: string,
		riskLevel: TripWeatherForecast["riskLevel"],
		worst: TripWeatherWorstReading
	): boolean {
		if (
			latest.status !== TripWeatherForecastStatus.AVAILABLE ||
			latest.tripStartsAt.getTime() !== startsAt.getTime() ||
			latest.tripEndsAt.getTime() !== endsAt.getTime() ||
			latest.ruleVersionId !== ruleId ||
			latest.riskLevel !== riskLevel ||
			!latest.worstReading
		) {
			return false;
		}
		const stored = latest.worstReading;
		return WORST_READING_KEYS.every((key) => stored[key] === worst[key]);
	}

	async getLatest(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherForecastResponseDto | null> {
		await this.loadAuthorizedTrip(actor, tripId);
		const latest = await this.forecastsRepository.findLatestForTrip(tripId);
		return latest
			? toTripWeatherForecastResponse(latest, WEATHER_FORECAST_HORIZON_DAYS, HOST_ADMIN_VIEW)
			: null;
	}

	/**
	 * How the forecast for the Trip's dates changed over time, newest first (policy §4). One row per
	 * change; `checkedAt` tells when an unchanged result was last confirmed.
	 * Admin: any Trip. Host: own Trips. Camper/Porter: published or ongoing Trips (the same scope as
	 * the trip-dates forecast). Anything else is indistinguishable from an absent Trip.
	 */
	async getHistory(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherForecastResponseDto[]> {
		const trip = await this.forecastsRepository.findTripForForecast(tripId);
		const roles = actor.roles;
		const allowed =
			trip !== null &&
			(roles.includes(UserRole.ADMIN) ||
				trip.hostId === actor.userId ||
				((roles.includes(UserRole.CAMPER) || roles.includes(UserRole.PORTER)) &&
					TRAVELLER_VISIBLE_TRIP_STATUSES.has(trip.status)));
		if (!allowed) throw new NotFoundException("Trip not found");
		const rows = await this.forecastsRepository.findHistory(tripId, HISTORY_LIMIT);
		// The AI opinion is an internal review aid; travellers only see the official level.
		const view = {
			includeAiReview: roles.includes(UserRole.ADMIN) || trip.hostId === actor.userId,
		};
		return rows.map((row) =>
			toTripWeatherForecastResponse(row, WEATHER_FORECAST_HORIZON_DAYS, view)
		);
	}

	/** The forecast that was attached to the Trip when it was submitted for approval. */
	async getSubmitted(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherForecastResponseDto | null> {
		const trip = await this.loadAuthorizedTrip(actor, tripId);
		if (!trip.submittedWeatherForecastId) return null;
		const forecast = await this.forecastsRepository.findByIdForTrip(
			tripId,
			trip.submittedWeatherForecastId
		);
		return forecast
			? toTripWeatherForecastResponse(forecast, WEATHER_FORECAST_HORIZON_DAYS, HOST_ADMIN_VIEW)
			: null;
	}

	/** Explains the latest available forecast with the LLM; idempotent per forecast. */
	async generateAdvice(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherForecastResponseDto> {
		await this.loadAuthorizedTrip(actor, tripId);
		const latest = await this.forecastsRepository.findLatestForTrip(tripId);
		if (
			!latest ||
			latest.status !== TripWeatherForecastStatus.AVAILABLE ||
			!latest.riskLevel ||
			latest.compositeScore === null ||
			!latest.criteriaScores
		) {
			throw new ConflictException("No weather forecast to explain for this Trip yet.");
		}
		if (latest.adviceText) {
			return toTripWeatherForecastResponse(latest, WEATHER_FORECAST_HORIZON_DAYS, HOST_ADMIN_VIEW);
		}

		const criteria = latest.criteriaScores;
		let result: Awaited<ReturnType<WeatherAdviceProvider["generate"]>>;
		try {
			result = await this.withRetry(() =>
				this.adviceProvider.generate({
					riskLevel: latest.riskLevel as string,
					compositeScore: latest.compositeScore as number,
					rainfall: criteria.rainfall,
					wind: criteria.wind,
					temperature: criteria.temperature,
					visibility: criteria.visibility,
					thunderstorm: criteria.thunderstorm,
				})
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown weather advice error";
			this.logger.error(`Trip weather advice failed for trip ${tripId}: ${message}`);
			throw new ServiceUnavailableException(
				"Weather advice service is currently unavailable. Please try again."
			);
		}

		const updated = await this.forecastsRepository.saveAdvice(
			latest.id,
			result.adviceText,
			result.actions
		);
		return toTripWeatherForecastResponse(
			updated ?? latest,
			WEATHER_FORECAST_HORIZON_DAYS,
			HOST_ADMIN_VIEW
		);
	}

	private async loadAuthorizedTrip(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripForWeatherForecast> {
		const trip = await this.forecastsRepository.findTripForForecast(tripId);
		if (!trip) throw new NotFoundException("Trip not found");
		if (!actor.roles.includes(UserRole.ADMIN) && trip.hostId !== actor.userId) {
			throw new ForbiddenException("Only the owning Host can access this Trip's weather forecast");
		}
		return trip;
	}

	private isReusable(
		latest: TripWeatherForecast,
		startsAt: Date,
		endsAt: Date,
		activeRule: WeatherRiskRule | null,
		now: Date
	): boolean {
		const sameSchedule =
			latest.tripStartsAt.getTime() === startsAt.getTime() &&
			latest.tripEndsAt.getTime() === endsAt.getTime();
		if (!sameSchedule) return false;
		if (latest.status === TripWeatherForecastStatus.OUT_OF_RANGE) return activeRule === null;
		return (
			activeRule !== null &&
			latest.ruleVersionId === activeRule.id &&
			now.getTime() - (latest.checkedAt ?? latest.createdAt).getTime() < REUSE_WINDOW_MS
		);
	}

	private async fetchWithRetry(
		tripId: string,
		latitude: number,
		longitude: number,
		from: Date,
		to: Date
	) {
		try {
			return await this.withRetry(() =>
				this.weatherProvider.fetchHourlyForecast(latitude, longitude, from, to)
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown weather provider error";
			this.logger.error(`Trip weather forecast failed for trip ${tripId}: ${message}`);
			// BR-229: never fabricate a forecast; nothing is stored for a failed fetch.
			throw new ServiceUnavailableException(
				"Weather provider is currently unavailable. Please try again."
			);
		}
	}

	private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
		let lastError: unknown;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;
				if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[attempt] ?? 1000);
			}
		}
		throw lastError;
	}
}

/** Last forecastable hour: 23:00 UTC on the horizon's final day. */
export function forecastHorizonEnd(now: Date): Date {
	const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return new Date(dayStart + (WEATHER_FORECAST_HORIZON_DAYS + 1) * 24 * HOUR_MS - HOUR_MS);
}

/**
 * Worst value of each criterion across the window, so a single dangerous hour is
 * enough to raise the Trip's risk. Temperature takes the hour with the highest
 * score, breaking ties by distance from the comfortable range's midpoint.
 */
export function worstReading(
	hours: WeatherForecastHour[],
	rule: WeatherRiskRule
): TripWeatherWorstReading {
	const pick = (better: (a: WeatherForecastHour, b: WeatherForecastHour) => boolean) =>
		hours.reduce((worst, hour) => (better(hour, worst) ? hour : worst), hours[0]);
	const rain = pick((a, b) => a.rainfallMm > b.rainfallMm);
	const wind = pick((a, b) => a.windKph > b.windKph);
	const visibility = pick((a, b) => a.visibilityM < b.visibilityM);
	const comfortMid = (rule.tempLowYellow + rule.tempHighYellow) / 2;
	const temperature = pick((a, b) => {
		const scoreA = scoreTemperature(a.temperatureC, rule).score;
		const scoreB = scoreTemperature(b.temperatureC, rule).score;
		if (scoreA !== scoreB) return scoreA > scoreB;
		return Math.abs(a.temperatureC - comfortMid) > Math.abs(b.temperatureC - comfortMid);
	});
	const storm = hours.find((hour) => hour.thunderstorm) ?? null;
	return {
		rainfallMm: rain.rainfallMm,
		rainfallAt: rain.time.toISOString(),
		windKph: wind.windKph,
		windAt: wind.time.toISOString(),
		temperatureC: temperature.temperatureC,
		temperatureAt: temperature.time.toISOString(),
		visibilityM: visibility.visibilityM,
		visibilityAt: visibility.time.toISOString(),
		thunderstorm: storm !== null,
		thunderstormAt: storm ? storm.time.toISOString() : null,
		hoursCovered: hours.length,
	};
}

function floorToHour(date: Date): Date {
	const copy = new Date(date.getTime());
	copy.setUTCMinutes(0, 0, 0);
	return copy;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
