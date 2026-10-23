import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserRole } from "../../users/entities/user.entity";
import type { WeatherRiskAssessmentResponseDto } from "../dto/weather-risk-assessment-response.dto";
import type { WeatherRiskAssessment } from "../entities/weather-risk-assessment.entity";
import { WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";
import { scoreWeatherReading } from "./weather-risk-scoring";

function toResponse(assessment: WeatherRiskAssessment): WeatherRiskAssessmentResponseDto {
	return {
		id: assessment.id,
		routeId: assessment.routeId,
		snapshotId: assessment.snapshotId,
		ruleVersionId: assessment.ruleVersionId,
		riskLevel: assessment.riskLevel,
		compositeScore: assessment.compositeScore,
		criteriaScores: assessment.criteriaScores,
		createdBy: assessment.createdBy,
		createdAt: assessment.createdAt,
	};
}

@Injectable()
export class WeatherRiskService {
	private readonly logger = new Logger(WeatherRiskService.name);

	constructor(
		private readonly weatherRiskRepository: WeatherRiskRepository,
		private readonly weatherSnapshotsRepository: WeatherSnapshotsRepository
	) {}

	async calculateForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherRiskAssessmentResponseDto> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);

		// BR-243: unmet business conditions must not create any side effect.
		if (route.status !== TrekkingRouteStatus.ACTIVE) {
			throw new ConflictException("Weather risk score can only be calculated for an active route");
		}

		const latestSnapshot = await this.weatherSnapshotsRepository.findLatestForRoute(routeId);
		if (!latestSnapshot || latestSnapshot.status !== WeatherSnapshotStatus.SUCCESS) {
			throw new ConflictException(
				"No successful weather snapshot found for this route. Please refresh weather data first."
			);
		}

		const activeRule = await this.weatherRiskRepository.findActiveRule();
		if (!activeRule) {
			throw new ConflictException("No active weather risk rules configured in the system.");
		}

		// BR-230 & Idempotency check: if assessment already exists for this snapshot and rule version
		const existing = await this.weatherRiskRepository.findExistingAssessment(
			latestSnapshot.id,
			activeRule.id
		);
		if (existing) {
			this.logger.log(
				`Returning existing weather risk assessment ${existing.id} for snapshot ${latestSnapshot.id}`
			);
			return toResponse(existing);
		}

		const { criteriaScores, compositeScore, riskLevel } = scoreWeatherReading(
			{
				rainfallMm: latestSnapshot.rainfallMm ?? 0,
				windKph: latestSnapshot.windKph ?? 0,
				temperatureC: latestSnapshot.temperatureC ?? 20,
				visibilityM: latestSnapshot.visibilityM ?? 10000,
				thunderstorm: latestSnapshot.thunderstorm ?? false,
			},
			activeRule
		);

		const assessment = await this.weatherRiskRepository.createAssessment({
			routeId,
			snapshotId: latestSnapshot.id,
			ruleVersionId: activeRule.id,
			riskLevel,
			compositeScore,
			criteriaScores,
			createdBy: actor.userId,
		});

		return toResponse(assessment);
	}

	async getLatestForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherRiskAssessmentResponseDto | null> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);

		const assessment = await this.weatherRiskRepository.findLatestAssessmentForRoute(routeId);
		return assessment ? toResponse(assessment) : null;
	}

	private assertOwnerOrAdmin(actor: AuthenticatedUser, owningHostId: string): void {
		if (actor.roles.includes(UserRole.ADMIN)) return;
		if (actor.userId !== owningHostId) {
			throw new ForbiddenException("Only the owning Host can access weather risk for this route");
		}
	}
}
