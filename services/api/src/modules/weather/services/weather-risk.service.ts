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
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
	type WeatherRiskAssessment,
} from "../entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import { WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";

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

		// Calculate criteria scores
		const rainfall = this.scoreRainfall(latestSnapshot.rainfallMm ?? 0, activeRule);
		const wind = this.scoreWind(latestSnapshot.windKph ?? 0, activeRule);
		const temperature = this.scoreTemperature(latestSnapshot.temperatureC ?? 20, activeRule);
		const visibility = this.scoreVisibility(latestSnapshot.visibilityM ?? 10000, activeRule);
		const thunderstorm = this.scoreThunderstorm(latestSnapshot.thunderstorm ?? false, activeRule);

		const compositeScore =
			rainfall.score * activeRule.rainfallWeight +
			wind.score * activeRule.windWeight +
			temperature.score * activeRule.temperatureWeight +
			visibility.score * activeRule.visibilityWeight +
			thunderstorm.score * activeRule.thunderstormWeight;

		const riskLevel = this.classifyRisk(compositeScore, activeRule);

		const criteriaScores: WeatherCriteriaScoresDetail = {
			rainfall,
			wind,
			temperature,
			visibility,
			thunderstorm,
		};

		const assessment = await this.weatherRiskRepository.createAssessment({
			routeId,
			snapshotId: latestSnapshot.id,
			ruleVersionId: activeRule.id,
			riskLevel,
			compositeScore: Number(compositeScore.toFixed(4)),
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

	private scoreRainfall(value: number, rule: WeatherRiskRule) {
		let level = RiskLevel.GREEN;
		let score = 0;
		if (value >= rule.rainfallRedThreshold) {
			level = RiskLevel.RED;
			score = 2;
		} else if (value >= rule.rainfallYellowThreshold) {
			level = RiskLevel.YELLOW;
			score = 1;
		}
		return { value, level, weight: rule.rainfallWeight, score };
	}

	private scoreWind(value: number, rule: WeatherRiskRule) {
		let level = RiskLevel.GREEN;
		let score = 0;
		if (value >= rule.windRedThreshold) {
			level = RiskLevel.RED;
			score = 2;
		} else if (value >= rule.windYellowThreshold) {
			level = RiskLevel.YELLOW;
			score = 1;
		}
		return { value, level, weight: rule.windWeight, score };
	}

	private scoreTemperature(value: number, rule: WeatherRiskRule) {
		let level = RiskLevel.GREEN;
		let score = 0;
		if (value <= rule.tempLowRed || value >= rule.tempHighRed) {
			level = RiskLevel.RED;
			score = 2;
		} else if (value <= rule.tempLowYellow || value >= rule.tempHighYellow) {
			level = RiskLevel.YELLOW;
			score = 1;
		}
		return { value, level, weight: rule.temperatureWeight, score };
	}

	private scoreVisibility(value: number, rule: WeatherRiskRule) {
		let level = RiskLevel.GREEN;
		let score = 0;
		if (value <= rule.visibilityRedThreshold) {
			level = RiskLevel.RED;
			score = 2;
		} else if (value <= rule.visibilityYellowThreshold) {
			level = RiskLevel.YELLOW;
			score = 1;
		}
		return { value, level, weight: rule.visibilityWeight, score };
	}

	private scoreThunderstorm(value: boolean, rule: WeatherRiskRule) {
		let level = RiskLevel.GREEN;
		let score = 0;
		if (value) {
			if (rule.thunderstormRed) {
				level = RiskLevel.RED;
				score = 2;
			} else if (rule.thunderstormYellow) {
				level = RiskLevel.YELLOW;
				score = 1;
			}
		}
		return { value, level, weight: rule.thunderstormWeight, score };
	}

	private classifyRisk(score: number, rule: WeatherRiskRule): RiskLevel {
		if (score < rule.greenMaxScore) {
			return RiskLevel.GREEN;
		}
		if (score < rule.yellowMaxScore) {
			return RiskLevel.YELLOW;
		}
		return RiskLevel.RED;
	}
}
