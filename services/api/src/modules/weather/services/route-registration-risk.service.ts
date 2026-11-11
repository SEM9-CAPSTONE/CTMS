import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserStatus } from "../../users/entities/user.entity";
import type {
	RegistrationBlockedReasonDto,
	RegistrationEligibilityResponseDto,
} from "../dto/registration-eligibility-response.dto";
import {
	TripWeatherForecast,
	TripWeatherForecastStatus,
} from "../entities/trip-weather-forecast.entity";
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
	WeatherRiskAssessment,
} from "../entities/weather-risk-assessment.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { WeatherRiskRepository } from "../repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires value imports
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";

/** Trip schedule used to pick the forecast that covers the booked dates. */
export interface BookingTripSchedule {
	id: string;
	startsAt: Date;
	endsAt: Date;
}

/** A trip-date forecast older than this no longer decides a booking; the Route rule applies instead. */
export const TRIP_FORECAST_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * A Red trip-date forecast blocks new bookings only this close to departure (policy §3): further out
 * the forecast is not reliable enough, so the booking is allowed with a warning shown in the UI.
 */
export const TRIP_FORECAST_BLOCKING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

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

	async assertBookingWeatherAllowed(
		routeId: string,
		manager: EntityManager,
		trip?: BookingTripSchedule,
		now: Date = new Date()
	): Promise<RegistrationEligibilityResponseDto> {
		if (trip) {
			const decision = await this.tripDateWeatherDecision(routeId, manager, trip, now);
			if (decision) return decision;
		}
		const latestAssessment = await manager.getRepository(WeatherRiskAssessment).findOne({
			where: { routeId },
			order: { createdAt: "DESC" },
		});
		if (!latestAssessment) {
			throw new ConflictException(
				"Chưa có đánh giá rủi ro thời tiết cho tuyến này. Mức rủi ro cần được tính toán trước khi đặt chỗ."
			);
		}

		const eligibility: RegistrationEligibilityResponseDto = {
			allowed: latestAssessment.riskLevel !== RiskLevel.RED,
			routeId,
			riskLevel: latestAssessment.riskLevel,
			assessmentTime: latestAssessment.createdAt,
			compositeScore: latestAssessment.compositeScore,
			reasons: [],
		};
		if (!eligibility.allowed) {
			this.extractFailingCriteriaReasons(latestAssessment.criteriaScores, eligibility.reasons);
			throw new ConflictException(
				"Không thể đặt chỗ mới do rủi ro thời tiết của tuyến đang ở mức BÁO ĐỘNG ĐỎ (RED)"
			);
		}

		return eligibility;
	}

	/**
	 * The booking is judged by the forecast for the Trip's own dates (e.g. a Trip on 10/11 by the 10/11
	 * forecast), not by the Route's current weather. Uses the latest stored forecast for the same
	 * schedule, made within TRIP_FORECAST_MAX_AGE_MS. Returns null when no such forecast exists, so the
	 * caller falls back to the Route assessment rule.
	 */
	private async tripDateWeatherDecision(
		routeId: string,
		manager: EntityManager,
		trip: BookingTripSchedule,
		now: Date
	): Promise<RegistrationEligibilityResponseDto | null> {
		const forecast = await manager.getRepository(TripWeatherForecast).findOne({
			where: { tripId: trip.id },
			order: { createdAt: "DESC", id: "DESC" },
		});
		if (
			!forecast ||
			forecast.tripStartsAt.getTime() !== trip.startsAt.getTime() ||
			forecast.tripEndsAt.getTime() !== trip.endsAt.getTime() ||
			now.getTime() - forecast.createdAt.getTime() > TRIP_FORECAST_MAX_AGE_MS
		) {
			return null;
		}
		if (forecast.status === TripWeatherForecastStatus.OUT_OF_RANGE) {
			// The Trip is beyond the provider horizon: there is no forecast for its dates yet, and today's
			// weather says nothing about them, so the booking is not blocked on weather.
			return {
				allowed: true,
				routeId,
				riskLevel: null,
				assessmentTime: forecast.createdAt,
				compositeScore: null,
				reasons: [],
			};
		}
		if (!forecast.riskLevel || forecast.compositeScore === null) return null;
		const eligibility: RegistrationEligibilityResponseDto = {
			allowed: forecast.riskLevel !== RiskLevel.RED,
			routeId,
			riskLevel: forecast.riskLevel,
			assessmentTime: forecast.createdAt,
			compositeScore: forecast.compositeScore,
			reasons: [],
		};
		const withinBlockingWindow =
			trip.startsAt.getTime() - now.getTime() <= TRIP_FORECAST_BLOCKING_WINDOW_MS;
		if (!eligibility.allowed && !withinBlockingWindow) {
			// Red but more than 3 days out: low reliability, allow and let the Host decide later.
			return { ...eligibility, allowed: true };
		}
		if (!eligibility.allowed) {
			if (forecast.criteriaScores) {
				this.extractFailingCriteriaReasons(forecast.criteriaScores, eligibility.reasons);
			}
			throw new ConflictException(
				"Không thể đặt chỗ do dự báo thời tiết trong ngày diễn ra chuyến đi ở mức BÁO ĐỘNG ĐỎ (RED)"
			);
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
