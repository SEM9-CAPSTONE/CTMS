import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
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
import { scoreTemperature, scoreWeatherReading } from "./weather-risk-scoring";

const FORECASTABLE_TRIP_STATUSES = new Set(["draft", "pending_approval", "published"]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000];
const HOUR_MS = 60 * 60 * 1000;
/** Repeated requests within this window reuse the stored forecast instead of calling the provider. */
const REUSE_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class TripWeatherForecastService {
	private readonly logger = new Logger(TripWeatherForecastService.name);

	constructor(
		private readonly forecastsRepository: TripWeatherForecastsRepository,
		private readonly weatherRiskRepository: WeatherRiskRepository,
		@Inject(WEATHER_PROVIDER) private readonly weatherProvider: WeatherProvider,
		@Inject(WEATHER_ADVICE_PROVIDER) private readonly adviceProvider: WeatherAdviceProvider
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
			return toTripWeatherForecastResponse(latest, WEATHER_FORECAST_HORIZON_DAYS);
		}

		if (outOfRange || !activeRule) {
			const saved = await this.forecastsRepository.save(
				this.forecastsRepository.create({
					tripId,
					routeId: trip.routeId,
					status: TripWeatherForecastStatus.OUT_OF_RANGE,
					tripStartsAt: startsAt,
					tripEndsAt: endsAt,
					createdBy: actor.userId,
				})
			);
			return toTripWeatherForecastResponse(saved, WEATHER_FORECAST_HORIZON_DAYS);
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
				providerResponse: forecast.raw,
				createdBy: actor.userId,
			})
		);
		return toTripWeatherForecastResponse(saved, WEATHER_FORECAST_HORIZON_DAYS);
	}

	async getLatest(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherForecastResponseDto | null> {
		await this.loadAuthorizedTrip(actor, tripId);
		const latest = await this.forecastsRepository.findLatestForTrip(tripId);
		return latest ? toTripWeatherForecastResponse(latest, WEATHER_FORECAST_HORIZON_DAYS) : null;
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
		return forecast ? toTripWeatherForecastResponse(forecast, WEATHER_FORECAST_HORIZON_DAYS) : null;
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
			return toTripWeatherForecastResponse(latest, WEATHER_FORECAST_HORIZON_DAYS);
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
		return toTripWeatherForecastResponse(updated ?? latest, WEATHER_FORECAST_HORIZON_DAYS);
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
			now.getTime() - latest.createdAt.getTime() < REUSE_WINDOW_MS
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
