import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import type { TripWeatherAiMismatchDto } from "../dto/trip-weather-ai-review.dto";
import { TripWeatherForecastStatus } from "../entities/trip-weather-forecast.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import {
	WEATHER_RISK_REVIEW_PROVIDER,
	WeatherRiskReviewError,
	type WeatherRiskReviewProvider,
} from "../providers/weather-risk-review.provider";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherForecastsRepository } from "../repositories/trip-weather-forecasts.repository";

/** Each forecast gets at most this many AI calls; a failed review is never fatal. */
export const WEATHER_AI_REVIEW_MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 20;
const MISMATCH_LIMIT = 100;

const LEVEL_RANK: Record<RiskLevel, number> = {
	[RiskLevel.GREEN]: 0,
	[RiskLevel.YELLOW]: 1,
	[RiskLevel.RED]: 2,
};

export interface WeatherAiReviewRunResult {
	reviewed: number;
	failed: number;
	skipped: boolean;
}

/**
 * Hybrid weather risk (leader decision, option C): the configured thresholds keep deciding the
 * official level, and an AI gives an independent opinion on the same raw readings. A disagreement
 * is listed for the Admin so thresholds that look too strict or too loose can be reviewed. Nothing
 * here changes `riskLevel`, booking blocks, Host decisions or penalties.
 */
@Injectable()
export class TripWeatherAiReviewService {
	private readonly logger = new Logger(TripWeatherAiReviewService.name);

	constructor(
		private readonly forecastsRepository: TripWeatherForecastsRepository,
		@Optional()
		@Inject(WEATHER_RISK_REVIEW_PROVIDER)
		private readonly provider?: WeatherRiskReviewProvider
	) {}

	/** One pass over the forecasts still waiting for an AI opinion (run by the monitor worker). */
	async reviewPending(
		now: Date = new Date(),
		batchSize = DEFAULT_BATCH_SIZE
	): Promise<WeatherAiReviewRunResult> {
		if (!this.provider?.isConfigured()) return { reviewed: 0, failed: 0, skipped: true };
		const forecasts = await this.forecastsRepository.findPendingAiReviews(
			now,
			batchSize,
			WEATHER_AI_REVIEW_MAX_ATTEMPTS
		);
		let reviewed = 0;
		let failed = 0;
		for (const forecast of forecasts) {
			const reading = forecast.worstReading;
			if (forecast.status !== TripWeatherForecastStatus.AVAILABLE || !reading) continue;
			try {
				const result = await this.provider.review({
					rainfallMm: reading.rainfallMm,
					windKph: reading.windKph,
					temperatureC: reading.temperatureC,
					visibilityM: reading.visibilityM,
					thunderstorm: reading.thunderstorm,
					hoursCovered: Math.max(1, Math.round(Number(reading.hoursCovered) || 1)),
				});
				await this.forecastsRepository.saveAiReview(forecast.id, result, now);
				reviewed += 1;
			} catch (error) {
				failed += 1;
				const retryable = error instanceof WeatherRiskReviewError ? error.retryable : true;
				const code = error instanceof WeatherRiskReviewError ? error.code : "unexpected_error";
				this.logger.warn(`AI weather review failed for forecast ${forecast.id}: ${code}`);
				await this.forecastsRepository.recordAiReviewFailure(
					forecast.id,
					WEATHER_AI_REVIEW_MAX_ATTEMPTS,
					!retryable
				);
				// The AI service is down or unconfigured for everyone; try again on the next tick.
				if (code === "provider_not_configured" || code === "provider_http_401") break;
			}
		}
		if (forecasts.length > 0) {
			this.logger.log(`AI weather review: ${reviewed} reviewed, ${failed} failed`);
		}
		return { reviewed, failed, skipped: false };
	}

	/** Trips whose thresholds and AI disagree and that no Admin has marked as seen. */
	async listMismatches(now: Date = new Date()): Promise<TripWeatherAiMismatchDto[]> {
		const rows = await this.forecastsRepository.findAiMismatches(now, MISMATCH_LIMIT);
		return rows.map((row) => ({
			forecastId: row.forecastId,
			tripId: row.tripId,
			tripTitle: row.tripTitle,
			tripStatus: row.tripStatus,
			tripStartsAt: row.tripStartsAt,
			hostId: row.hostId,
			hostName: row.hostName,
			riskLevel: row.riskLevel as RiskLevel,
			aiRiskLevel: row.aiRiskLevel as RiskLevel,
			aiReason: row.aiReason,
			aiConfidence: Number(row.aiConfidence),
			aiReviewedAt: row.aiReviewedAt,
			gap: levelGap(row.riskLevel as RiskLevel, row.aiRiskLevel as RiskLevel),
			worstReading: row.worstReading,
			ruleVersion: row.ruleVersion === null ? null : Number(row.ruleVersion),
		}));
	}

	async acknowledge(actor: AuthenticatedUser, forecastId: string, now: Date = new Date()) {
		const forecast = await this.forecastsRepository.findOneBy({ id: forecastId });
		if (!forecast) throw new NotFoundException("Weather forecast not found");
		if (forecast.aiReviewAcknowledgedAt) {
			return { forecastId, acknowledgedAt: forecast.aiReviewAcknowledgedAt };
		}
		if (!forecast.aiRiskLevel || forecast.aiRiskLevel === forecast.riskLevel) {
			throw new ConflictException("This forecast has no disagreement with the AI to review");
		}
		const updated = await this.forecastsRepository.acknowledgeAiReview(
			forecastId,
			actor.userId,
			now
		);
		if (!updated) {
			const current = await this.forecastsRepository.findOneBy({ id: forecastId });
			return { forecastId, acknowledgedAt: current?.aiReviewAcknowledgedAt ?? now };
		}
		return { forecastId, acknowledgedAt: now };
	}
}

/** 0 = same level, 1 = one step apart (e.g. Yellow vs Red), 2 = Green vs Red. */
export function levelGap(a: RiskLevel | null, b: RiskLevel | null): number {
	if (!a || !b) return 0;
	return Math.abs(LEVEL_RANK[a] - LEVEL_RANK[b]);
}
