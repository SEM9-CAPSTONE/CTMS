import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserStatus } from "../../users/entities/user.entity";
import type {
	RegistrationBlockedReasonDto,
	RegistrationEligibilityResponseDto,
} from "../dto/registration-eligibility-response.dto";
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
} from "../entities/weather-risk-assessment.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";

@Injectable()
export class RouteRegistrationRiskService {
	private readonly logger = new Logger(RouteRegistrationRiskService.name);

	constructor(
		private readonly weatherRiskRepository: WeatherRiskRepository,
		private readonly weatherSnapshotsRepository: WeatherSnapshotsRepository,
		private readonly dataSource?: DataSource
	) {}

	/**
	 * Evaluates whether new registrations/bookings are allowed for a route based on latest weather risk.
	 * Returns eligibility payload with detailed reasons (BR-071, BR-073).
	 */
	async checkRouteEligibility(routeId: string): Promise<RegistrationEligibilityResponseDto> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}

		const latestAssessment = await this.weatherRiskRepository.findLatestAssessmentForRoute(routeId);
		if (!latestAssessment) {
			throw new ConflictException(
				"No weather risk assessment found for this route. Risk level must be calculated before registration."
			);
		}

		const isRed = latestAssessment.riskLevel === RiskLevel.RED;
		const reasons: RegistrationBlockedReasonDto[] = [];

		if (isRed) {
			this.extractFailingCriteriaReasons(latestAssessment.criteriaScores, reasons);
			if (reasons.length === 0) {
				reasons.push({
					criterion: "composite_score",
					level: RiskLevel.RED,
					value: latestAssessment.compositeScore,
					message: `Composite weather risk score (${latestAssessment.compositeScore}) exceeded Red risk threshold`,
				});
			}
		}

		return {
			allowed: !isRed,
			routeId,
			riskLevel: latestAssessment.riskLevel,
			assessmentTime: latestAssessment.createdAt,
			compositeScore: latestAssessment.compositeScore,
			reasons,
		};
	}

	/**
	 * Asserts that registration is allowed for a route.
	 * If risk level is RED, throws HTTP 409 Conflict with details and records an audit log (BR-072, BR-200, BR-243).
	 */
	async assertRegistrationAllowedForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<RegistrationEligibilityResponseDto> {
		this.assertActiveAccount(actor);

		const eligibility = await this.checkRouteEligibility(routeId);

		if (!eligibility.allowed) {
			await this.recordAuditLog(actor, routeId, "ROUTE", eligibility);

			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				message: "New registrations are blocked because route weather risk is RED",
				allowed: false,
				routeId: eligibility.routeId,
				riskLevel: eligibility.riskLevel,
				assessmentTime: eligibility.assessmentTime,
				compositeScore: eligibility.compositeScore,
				reasons: eligibility.reasons,
			});
		}

		return eligibility;
	}

	/**
	 * Asserts that registration is allowed for a given Trip by checking its associated TrekkingRoute risk.
	 */
	async assertRegistrationAllowedForTrip(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<RegistrationEligibilityResponseDto> {
		this.assertActiveAccount(actor);

		if (!this.dataSource) {
			throw new Error("DataSource required for trip lookup");
		}

		const trips = (await this.dataSource.query(
			'SELECT "id", "route_id" FROM "trips" WHERE "id" = $1',
			[tripId]
		)) as Array<{ id: string; route_id: string | null }>;

		if (!trips || trips.length === 0) {
			throw new NotFoundException("Trip not found");
		}

		const routeId = trips[0].route_id;
		if (!routeId) {
			// Trip without linked route defaults to allowed unless route is defined
			return {
				allowed: true,
				routeId: "",
				riskLevel: RiskLevel.GREEN,
				assessmentTime: new Date(),
				compositeScore: 0,
				reasons: [],
			};
		}

		const eligibility = await this.assertRegistrationAllowedForRoute(actor, routeId);

		if (!eligibility.allowed) {
			await this.recordAuditLog(actor, tripId, "TRIP", eligibility);
		}

		return eligibility;
	}

	private assertActiveAccount(actor: AuthenticatedUser): void {
		// BR-201 & BR-202: Must have a valid session and active account status
		if (!actor || !actor.userId) {
			throw new UnauthorizedException("Authentication required");
		}
		if (actor.status && actor.status !== UserStatus.ACTIVE) {
			throw new ForbiddenException(
				"Account is not active. Suspended or unverified accounts cannot perform registration operations."
			);
		}
	}

	private extractFailingCriteriaReasons(
		criteria: WeatherCriteriaScoresDetail,
		reasons: RegistrationBlockedReasonDto[]
	): void {
		if (!criteria) return;

		if (criteria.rainfall?.level === RiskLevel.RED) {
			reasons.push({
				criterion: "rainfall",
				level: RiskLevel.RED,
				value: criteria.rainfall.value,
				message: `Lượng mưa (${criteria.rainfall.value}mm) vượt quá ngưỡng nguy hiểm Mức Đỏ`,
			});
		}
		if (criteria.wind?.level === RiskLevel.RED) {
			reasons.push({
				criterion: "wind",
				level: RiskLevel.RED,
				value: criteria.wind.value,
				message: `Tốc độ gió (${criteria.wind.value}km/h) vượt quá ngưỡng nguy hiểm Mức Đỏ`,
			});
		}
		if (criteria.temperature?.level === RiskLevel.RED) {
			reasons.push({
				criterion: "temperature",
				level: RiskLevel.RED,
				value: criteria.temperature.value,
				message: `Nhiệt độ (${criteria.temperature.value}°C) ở ngưỡng nguy hiểm Mức Đỏ`,
			});
		}
		if (criteria.visibility?.level === RiskLevel.RED) {
			reasons.push({
				criterion: "visibility",
				level: RiskLevel.RED,
				value: criteria.visibility.value,
				message: `Tầm nhìn xa (${criteria.visibility.value}m) thấp hơn ngưỡng an toàn Mức Đỏ`,
			});
		}
		if (criteria.thunderstorm?.level === RiskLevel.RED) {
			reasons.push({
				criterion: "thunderstorm",
				level: RiskLevel.RED,
				value: criteria.thunderstorm.value,
				message: "Phát hiện hoạt động dông sét nguy hiểm",
			});
		}
	}

	private async recordAuditLog(
		actor: AuthenticatedUser,
		targetId: string,
		targetType: "ROUTE" | "TRIP",
		eligibility: RegistrationEligibilityResponseDto
	): Promise<void> {
		if (!this.dataSource?.isInitialized) return;

		try {
			const auditRepo = this.dataSource.getRepository(AuditLog);
			const log = auditRepo.create({
				actorId: actor.userId,
				action: "REGISTRATION_BLOCKED_WEATHER_RISK_RED",
				targetId,
				targetType,
				before: null,
				after: {
					riskLevel: eligibility.riskLevel,
					assessmentTime: eligibility.assessmentTime,
					compositeScore: eligibility.compositeScore,
					reasons: eligibility.reasons as unknown as Record<string, unknown>[],
				},
				reason: "Route weather risk level is RED",
			});
			await auditRepo.save(log);
		} catch (error) {
			this.logger.warn(`Failed to record audit log for blocked registration: ${error}`);
		}
	}
}
