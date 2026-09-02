import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserRole } from "../../users/entities/user.entity";
import type { WeatherAdviceResponseDto } from "../dto/weather-advice-response.dto";
import type { WeatherAdvice } from "../entities/weather-advice.entity";
import {
	WEATHER_ADVICE_PROVIDER,
	type WeatherAdviceProvider,
} from "../providers/weather-advice-provider.interface";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherAdviceRepository } from "../repositories/weather-advice.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000, 2000];

function toResponse(advice: WeatherAdvice): WeatherAdviceResponseDto {
	return {
		id: advice.id,
		assessmentId: advice.assessmentId,
		adviceText: advice.adviceText,
		actions: advice.actions,
		createdBy: advice.createdBy,
		createdAt: advice.createdAt,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CTMS-29-T01. Turns an already-calculated `WeatherRiskAssessment`
 * (CTMS-26-T01) into clear, LLM-generated advice via the `ai` microservice.
 * Never recalculates or overrides `riskLevel`/`compositeScore` itself
 * (BR-076) -- this service only ever reads the assessment to build the
 * provider's request payload, and only ever persists `adviceText`/`actions`.
 */
@Injectable()
export class WeatherAdviceService {
	private readonly logger = new Logger(WeatherAdviceService.name);

	constructor(
		private readonly weatherAdviceRepository: WeatherAdviceRepository,
		private readonly weatherRiskRepository: WeatherRiskRepository,
		private readonly weatherSnapshotsRepository: WeatherSnapshotsRepository,
		@Inject(WEATHER_ADVICE_PROVIDER) private readonly weatherAdviceProvider: WeatherAdviceProvider
	) {}

	async generateForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherAdviceResponseDto> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);

		// BR-243: an unmet business condition (route not active) must not
		// create any side effect -- checked BEFORE any provider call or DB
		// write.
		if (route.status !== TrekkingRouteStatus.ACTIVE) {
			throw new ConflictException("Weather advice can only be generated for an active route");
		}

		const assessment = await this.weatherRiskRepository.findLatestAssessmentForRoute(routeId);
		if (!assessment) {
			throw new ConflictException(
				"No weather risk assessment found for this route. Please calculate a risk score first."
			);
		}

		// Idempotency (BR-230): a repeat request for the same, already-explained
		// assessment returns the existing advice instead of paying for and
		// persisting a second LLM call.
		const existing = await this.weatherAdviceRepository.findExistingForAssessment(assessment.id);
		if (existing) {
			this.logger.log(
				`Returning existing weather advice ${existing.id} for assessment ${assessment.id}`
			);
			return toResponse(existing);
		}

		try {
			const result = await this.generateWithRetry({
				riskLevel: assessment.riskLevel,
				compositeScore: assessment.compositeScore,
				rainfall: assessment.criteriaScores.rainfall,
				wind: assessment.criteriaScores.wind,
				temperature: assessment.criteriaScores.temperature,
				visibility: assessment.criteriaScores.visibility,
				thunderstorm: assessment.criteriaScores.thunderstorm,
			});

			const advice = await this.weatherAdviceRepository.createAdvice({
				assessmentId: assessment.id,
				adviceText: result.adviceText,
				actions: result.actions,
				createdBy: actor.userId,
			});
			return toResponse(advice);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown weather advice provider error";
			this.logger.error(`Weather advice generation failed for route ${routeId}: ${message}`);
			// BR-229: record the error, never assume success, never persist a
			// fabricated advice row.
			throw new ServiceUnavailableException(
				"Weather advice service is currently unavailable. Please try again."
			);
		}
	}

	async getLatestForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherAdviceResponseDto | null> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);

		const advice = await this.weatherAdviceRepository.findLatestForRoute(routeId);
		return advice ? toResponse(advice) : null;
	}

	private assertOwnerOrAdmin(actor: AuthenticatedUser, owningHostId: string): void {
		if (actor.roles.includes(UserRole.ADMIN)) return;
		if (actor.userId !== owningHostId) {
			throw new ForbiddenException("Only the owning Host can access weather advice for this route");
		}
	}

	/**
	 * BR-230: bounded retries with backoff, entirely in-memory -- only the
	 * final outcome (one success, or a thrown error with zero DB writes) is
	 * ever persisted, so a retry here can never itself create a duplicate
	 * row. Mirrors WeatherService's own `fetchWithRetry`.
	 */
	private async generateWithRetry(
		payload: Parameters<WeatherAdviceProvider["generate"]>[0]
	): ReturnType<WeatherAdviceProvider["generate"]> {
		let lastError: unknown;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				return await this.weatherAdviceProvider.generate(payload);
			} catch (error) {
				lastError = error;
				if (attempt < MAX_ATTEMPTS - 1) {
					await sleep(BACKOFF_MS[attempt]);
				}
			}
		}
		throw lastError;
	}
}
