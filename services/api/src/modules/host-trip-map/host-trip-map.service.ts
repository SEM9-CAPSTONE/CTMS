import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { SafetyEventType } from "../safety-events/safety-events.enums";
import {
	BehindScheduleLevel,
	ScheduleStatus,
} from "../schedule-progress/schedule-progress.evaluator";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ScheduleProgressService } from "../schedule-progress/schedule-progress.service";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import {
	HostTripAlertType,
	type HostTripAlertsQueryDto,
	type HostTripMapQueryDto,
} from "./host-trip-map.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { HostTripMapRepository } from "./host-trip-map.repository";
import {
	type HostTripMap,
	LocationFreshness,
	type MapParticipant,
	type MapParticipantRow,
} from "./host-trip-map.types";

const DEFAULT_FRESHNESS_MAX_AGE_SECONDS = 120;
const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class HostTripMapService {
	private readonly maxAge: number;
	constructor(
		private readonly repository: HostTripMapRepository,
		config: ConfigService,
		private readonly scheduleProgress: ScheduleProgressService
	) {
		this.maxAge = Number(
			config.get<string>("HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS") ??
				DEFAULT_FRESHNESS_MAX_AGE_SECONDS
		);
		if (!Number.isSafeInteger(this.maxAge) || this.maxAge <= 0) {
			throw new Error("HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS must be a positive safe integer");
		}
	}

	async getMap(
		actor: AuthenticatedUser,
		query: HostTripMapQueryDto,
		tripId: string | null = null
	): Promise<HostTripMap> {
		this.requireActiveHost(actor);
		const data = await this.repository.read(actor.userId, query.page, query.limit, tripId);
		const now = new Date();
		return {
			...data,
			generatedAt: now.toISOString(),
			freshnessMaxAgeSeconds: this.maxAge,
			locationSource: "server_confirmed",
			page: query.page,
			limit: query.limit,
			items: data.items.map((trip) => ({
				...trip,
				participants: trip.participants.map((p) => this.project(p, now)),
			})),
		};
	}

	async getAlerts(actor: AuthenticatedUser, tripId: string, query: HostTripAlertsQueryDto) {
		this.requireActiveHost(actor);
		const status = await this.repository.findOwnedTripStatus(actor.userId, tripId);
		if (!status) throw new NotFoundException("Trip not found");
		if (status !== TripStatus.ONGOING) throw new ConflictException("Trip is not ongoing");

		const map = await this.getMap(actor, { page: 1, limit: 1 }, tripId);
		const trip = map.items[0];
		if (!trip) throw new ConflictException("Active Trip map is unavailable");

		const includeSchedule = query.alertType !== HostTripAlertType.OFF_ROUTE;
		const progress = includeSchedule
			? await this.scheduleProgress.readProgress(actor.userId, tripId)
			: null;
		const progressByUser = new Map(progress?.members.map((member) => [member.userId, member]));
		const alerts = [];
		for (const participant of trip.participants) {
			if (participant.memberStatus === BookingMemberStatus.LEFT) continue;
			const context = {
				participantId: participant.id,
				role: participant.role,
				name: participant.name,
				location: participant.location,
				lastLocationAt: participant.lastSeenAt,
				freshness: participant.freshness,
				isStale: participant.freshness === LocationFreshness.STALE,
			};
			const route = participant.safety.route;
			if (
				!query.severity &&
				query.alertType !== HostTripAlertType.BEHIND_SCHEDULE &&
				route?.type === SafetyEventType.OFF_ROUTE
			) {
				alerts.push({
					...context,
					alertType: HostTripAlertType.OFF_ROUTE,
					severity: null,
					observedAt: route.eventTime,
				});
			}
			const schedule =
				participant.role === GpsParticipantRole.CAMPER && participant.userId
					? progressByUser.get(participant.userId)
					: undefined;
			const severity =
				schedule?.status === ScheduleStatus.BEHIND
					? BehindScheduleLevel.BEHIND
					: schedule?.status === ScheduleStatus.SEVERELY_BEHIND
						? BehindScheduleLevel.SEVERELY_BEHIND
						: null;
			if (severity && (!query.severity || query.severity === severity)) {
				alerts.push({
					...context,
					alertType: HostTripAlertType.BEHIND_SCHEDULE,
					severity,
					observedAt: progress?.evaluatedAt.toISOString(),
				});
			}
		}
		return {
			tripId,
			generatedAt: map.generatedAt,
			locationSource: map.locationSource,
			freshnessMaxAgeSeconds: map.freshnessMaxAgeSeconds,
			alerts,
		};
	}

	private requireActiveHost(actor: AuthenticatedUser): void {
		if (actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException("Active Host required");
		}
	}

	async getParticipant(
		actor: AuthenticatedUser,
		tripId: string,
		role: GpsParticipantRole,
		participantId: string
	) {
		const map = await this.getMap(actor, { page: 1, limit: 1 }, tripId);
		const participant = map.items[0]?.participants.find(
			(p) => p.id === participantId && p.role === role
		);
		if (!participant) throw new NotFoundException("Active Trip participant not found");
		return {
			generatedAt: map.generatedAt,
			freshnessMaxAgeSeconds: this.maxAge,
			locationSource: map.locationSource,
			tripId,
			participant,
		};
	}

	private project(participant: MapParticipantRow, now: Date): MapParticipant {
		const location = participant.location;
		const age = location
			? (now.getTime() - Date.parse(location.eventTime)) / MILLISECONDS_PER_SECOND
			: null;
		let freshness = LocationFreshness.UNAVAILABLE;
		if (age !== null) {
			// Future-dated captures are never described as fresh.
			freshness =
				age >= 0 && age <= this.maxAge ? LocationFreshness.FRESH : LocationFreshness.STALE;
		}
		return {
			...participant,
			lastSeenAt: location?.eventTime ?? null,
			freshness,
			locationAgeSeconds: age === null ? null : Math.max(0, Math.floor(age)),
		};
	}
}
