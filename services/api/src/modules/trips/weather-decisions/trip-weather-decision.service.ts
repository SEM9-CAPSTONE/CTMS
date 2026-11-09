import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripsRepository } from "../repositories/trips.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripsService } from "../services/trips.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherDecisionAlertsService } from "./trip-weather-decision-alerts.service";
import {
	type AdminWeatherDecisionDto,
	type HostWeatherDecisionDto,
	type TripWeatherDecisionDto,
	type TripWeatherDecisionLogDto,
	type WeatherInterventionDto,
	type WeatherRescheduleResponseResultDto,
	toTripWeatherDecisionDto,
} from "./trip-weather-decision.dto";
import {
	WEATHER_DECISION_WINDOW_MS,
	type WeatherDeciderRole,
	type WeatherDecision,
	compareUrgency,
	interventionUrgency,
	isLateHostDecision,
	isWithinDecisionWindow,
	needsAdminIntervention,
} from "./trip-weather-decision.policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type LatestTripForecast,
	TripWeatherDecisionsRepository,
	WEATHER_RESCHEDULE_AUDIT_REASON,
	type WeatherDecisionTrip,
} from "./trip-weather-decisions.repository";

const DECISION_LOG_LIMIT = 50;
const INTERVENTION_LIMIT = 200;
const DECLINE_REASON = "Không nhận ngày mới sau khi Trip dời lịch vì thời tiết";

interface DecisionContext {
	trip: WeatherDecisionTrip;
	forecast: LatestTripForecast | null;
	now: Date;
}

/**
 * Weather decision near departure, docs/features/weather-trip-date-decision-policy.md §5:
 * the Host keeps / reschedules / cancels a Red Trip in the last 3 days, the Admin intervenes
 * (also pause / resume), and Campers of a weather-rescheduled Trip accept or decline.
 */
@Injectable()
export class TripWeatherDecisionService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly decisions: TripWeatherDecisionsRepository,
		private readonly tripsService: TripsService,
		private readonly tripsRepository: TripsRepository,
		private readonly alerts: TripWeatherDecisionAlertsService
	) {}

	async decideAsHost(
		hostId: string,
		tripId: string,
		dto: HostWeatherDecisionDto,
		now = new Date()
	): Promise<TripWeatherDecisionDto> {
		const context = await this.loadContext(tripId, now);
		if (context.trip.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can decide for this Trip");
		}
		this.assertDecidable(context, true);
		const schedule = await this.decisions.findDecisionsForSchedule(tripId, context.trip.startsAt);
		if (schedule.some((decision) => decision.deciderRole === "admin")) {
			throw new ConflictException("An Admin has already decided for this Trip");
		}
		if (dto.decision === "keep" && !dto.safetyPlan) {
			throw new UnprocessableEntityException("A safety plan is required to keep a Red Trip");
		}
		const record = this.recorder(context, hostId, "host", dto.decision, dto.reason, {
			safetyPlan: dto.decision === "keep" ? (dto.safetyPlan ?? null) : null,
			late: isLateHostDecision(context.trip.startsAt, now),
		});
		const saved = await this.apply(context, hostId, dto, record, false);
		if (dto.decision === "keep") {
			await this.alerts.send(
				{
					tripId,
					hostId: context.trip.hostId,
					title: context.trip.title,
					startsAt: context.trip.startsAt,
					forecastId: context.forecast?.id ?? null,
				},
				["admin_kept"]
			);
		}
		return saved;
	}

	async decideAsAdmin(
		adminId: string,
		tripId: string,
		dto: AdminWeatherDecisionDto,
		now = new Date()
	): Promise<TripWeatherDecisionDto> {
		const context = await this.loadContext(tripId, now);
		// Resuming a paused Trip is allowed even when the forecast is no longer Red.
		this.assertDecidable(context, dto.decision !== "resume");
		if (dto.decision === "pause" && context.trip.weatherPausedAt) {
			throw new ConflictException("Trip is already paused");
		}
		if (dto.decision === "resume" && !context.trip.weatherPausedAt) {
			throw new ConflictException("Trip is not paused");
		}
		const record = this.recorder(context, adminId, "admin", dto.decision, dto.reason, {
			safetyPlan: null,
			late: false,
		});
		return this.apply(context, adminId, dto, record, true);
	}

	async getDecisionLog(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<TripWeatherDecisionLogDto> {
		const trip = await this.decisions.findTrip(tripId);
		const isAdmin = actor.roles.includes(UserRole.ADMIN);
		if (!trip || (!isAdmin && trip.hostId !== actor.userId)) {
			throw new NotFoundException("Trip not found");
		}
		const [forecast, rows] = await Promise.all([
			this.decisions.findLatestForecast(tripId),
			this.decisions.findDecisions(tripId, DECISION_LOG_LIMIT),
		]);
		return {
			tripId,
			tripStatus: trip.status,
			startsAt: trip.startsAt,
			weatherPausedAt: trip.weatherPausedAt,
			weatherPauseReason: trip.weatherPauseReason,
			latestRiskLevel: forecast?.riskLevel ?? null,
			withinDecisionWindow:
				trip.status === TripStatus.PUBLISHED &&
				isWithinDecisionWindow(new Date(trip.startsAt), new Date()),
			decisions: rows.map(toTripWeatherDecisionDto),
		};
	}

	/** Trips an Admin must handle now, most urgent first (policy §5.3 / §5.4). */
	async listInterventions(now = new Date()): Promise<WeatherInterventionDto[]> {
		const candidates = await this.decisions.findRedTripsStartingWithin(
			now,
			WEATHER_DECISION_WINDOW_MS,
			INTERVENTION_LIMIT
		);
		return candidates
			.filter((candidate) =>
				needsAdminIntervention(
					{
						startsAt: new Date(candidate.startsAt),
						hostDecision: candidate.hostDecision,
						adminDecided: candidate.adminDecided,
					},
					now
				)
			)
			.map((candidate) => ({
				tripId: candidate.tripId,
				tripTitle: candidate.title,
				hostId: candidate.hostId,
				startsAt: candidate.startsAt,
				forecastId: candidate.forecastId,
				reason: candidate.hostDecision === "keep" ? "host_kept" : "no_response",
				urgency: interventionUrgency(new Date(candidate.startsAt), now),
				hostDecisionReason: candidate.hostDecisionReason,
				hostSafetyPlan: candidate.hostSafetyPlan,
				weatherPausedAt: candidate.weatherPausedAt,
			}))
			.sort(
				(a, b) =>
					compareUrgency(a.urgency as never, b.urgency as never) ||
					new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
			);
	}

	/**
	 * Camper answer after a weather reschedule (policy §5.2): keep the booking on the new date, or
	 * cancel it with a 100% refund. Only for bookings moved by a weather decision.
	 */
	async respondToWeatherReschedule(
		userId: string,
		bookingId: string,
		accept: boolean,
		now = new Date()
	): Promise<WeatherRescheduleResponseResultDto> {
		return this.dataSource.transaction(async (manager) => {
			const booking = await this.decisions.findBookingForRescheduleResponse(manager, bookingId);
			if (!booking || booking.userId !== userId) throw new NotFoundException("Booking not found");
			if (booking.status !== "pending_reconfirmation") {
				throw new ConflictException("Booking is not waiting for a reschedule answer");
			}
			if (booking.tripStatus !== TripStatus.PUBLISHED || new Date(booking.tripStartsAt) <= now) {
				throw new ConflictException("Trip is no longer open for a reschedule answer");
			}
			if (!(await this.decisions.lastRescheduleWasForWeather(manager, booking.tripId))) {
				throw new ConflictException("This Trip was not rescheduled because of the weather");
			}
			let refundsCreated = 0;
			if (accept) {
				await this.decisions.reconfirmBooking(manager, bookingId, now);
			} else {
				const equipmentCancelled = await this.decisions.cancelBookingAfterDecline(
					manager,
					bookingId,
					now,
					DECLINE_REASON
				);
				const trips = manager.withRepository(this.tripsRepository);
				if (booking.totalAmount && Number(booking.totalAmount) > 0) {
					refundsCreated = await trips.createIdempotentRefund(
						bookingId,
						booking.totalAmount,
						`weather-reschedule-decline:booking:${bookingId}`
					);
				}
				await trips.recomputeSeatsTaken(booking.tripId);
				await this.audit(
					manager,
					userId,
					"booking.weather_reschedule_declined",
					"booking",
					bookingId,
					{
						refundPercent: 100,
						refundsCreated,
						equipmentCancelled,
					},
					DECLINE_REASON
				);
			}
			if (accept) {
				await this.audit(
					manager,
					userId,
					"booking.weather_reschedule_accepted",
					"booking",
					bookingId,
					{
						tripStartsAt: booking.tripStartsAt,
					},
					"weather_reschedule_accepted"
				);
			}
			return { bookingId, status: accept ? "confirmed" : "cancelled", refundsCreated };
		});
	}

	private async loadContext(tripId: string, now: Date): Promise<DecisionContext> {
		const trip = await this.decisions.findTrip(tripId);
		if (!trip) throw new NotFoundException("Trip not found");
		const forecast = await this.decisions.findLatestForecast(tripId);
		return { trip: { ...trip, startsAt: new Date(trip.startsAt) }, forecast, now };
	}

	private assertDecidable(context: DecisionContext, requireRed: boolean): void {
		if (context.trip.status !== TripStatus.PUBLISHED) {
			throw new ConflictException("Only a published Trip can get a weather decision");
		}
		if (context.trip.startsAt <= context.now) {
			throw new ConflictException("Trip has already started");
		}
		if (!isWithinDecisionWindow(context.trip.startsAt, context.now)) {
			throw new ConflictException("Weather decisions are only taken within 3 days of departure");
		}
		if (requireRed && context.forecast?.riskLevel !== "red") {
			throw new ConflictException("The latest forecast for the Trip dates is not Red");
		}
	}

	private recorder(
		context: DecisionContext,
		actorId: string,
		role: WeatherDeciderRole,
		decision: WeatherDecision,
		reason: string,
		extra: { safetyPlan: string | null; late: boolean }
	) {
		return async (manager: EntityManager): Promise<TripWeatherDecisionDto> => {
			const saved = await this.decisions.insertDecision(manager, {
				tripId: context.trip.id,
				forecastId: context.forecast?.id ?? null,
				riskLevel: context.forecast?.riskLevel ?? null,
				decidedBy: actorId,
				deciderRole: role,
				decision,
				reason,
				safetyPlan: extra.safetyPlan,
				late: extra.late,
				tripStartsAt: context.trip.startsAt,
				createdAt: context.now,
			});
			await this.audit(
				manager,
				actorId,
				"trip.weather_decision",
				"trip",
				context.trip.id,
				{
					decision,
					deciderRole: role,
					forecastId: context.forecast?.id ?? null,
					riskLevel: context.forecast?.riskLevel ?? null,
					safetyPlan: extra.safetyPlan,
					late: extra.late,
					tripStartsAt: context.trip.startsAt,
				},
				reason
			);
			return toTripWeatherDecisionDto(saved);
		};
	}

	/** Applies the decision; cancel and reschedule reuse the Host flows inside one transaction. */
	private async apply(
		context: DecisionContext,
		actorId: string,
		dto: HostWeatherDecisionDto | AdminWeatherDecisionDto,
		record: (manager: EntityManager) => Promise<TripWeatherDecisionDto>,
		actingAsAdmin: boolean
	): Promise<TripWeatherDecisionDto> {
		const tripId = context.trip.id;
		let saved: TripWeatherDecisionDto | null = null;
		const withinTransaction = async (manager: EntityManager) => {
			if (actingAsAdmin) await this.decisions.setPause(manager, tripId, null, null);
			saved = await record(manager);
		};
		if (dto.decision === "cancel") {
			await this.tripsService.cancel(
				actorId,
				tripId,
				{ reason: `Huỷ vì thời tiết: ${dto.reason}` },
				{ actingAsAdmin, withinTransaction }
			);
		} else if (dto.decision === "reschedule") {
			if (!dto.startsAt) {
				throw new UnprocessableEntityException("startsAt is required to reschedule");
			}
			await this.tripsService.reschedule(
				actorId,
				tripId,
				{ startsAt: dto.startsAt, endsAt: dto.endsAt },
				context.now,
				{ actingAsAdmin, auditReason: WEATHER_RESCHEDULE_AUDIT_REASON, withinTransaction }
			);
		} else {
			await this.dataSource.transaction(async (manager) => {
				const locked = await this.decisions.findTrip(tripId, { manager, lock: true });
				if (!locked || locked.status !== TripStatus.PUBLISHED) {
					throw new ConflictException("Only a published Trip can get a weather decision");
				}
				if (dto.decision === "pause") {
					await this.decisions.setPause(manager, tripId, context.now, dto.reason);
					saved = await record(manager);
				} else {
					// keep / resume: the Trip goes ahead, so any Admin pause is lifted.
					await withinTransaction(manager);
				}
			});
		}
		if (!saved) throw new Error("Weather decision was not recorded");
		return saved;
	}

	private async audit(
		manager: EntityManager,
		actorId: string,
		action: string,
		targetType: string,
		targetId: string,
		after: Record<string, unknown>,
		reason: string
	): Promise<void> {
		await manager.getRepository(AuditLog).save({
			actorId,
			action,
			targetType,
			targetId,
			before: null,
			after,
			reason,
		});
	}
}
