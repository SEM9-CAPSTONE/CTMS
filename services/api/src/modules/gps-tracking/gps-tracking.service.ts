import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { TripStatus } from "../trips/entities/trip.entity";
import type { CreateGpsLogsDto, GpsLogInputDto } from "./dto/create-gps-logs.dto";
import type {
	GpsLogIngestResponseDto,
	GpsLogIngestResultDto,
	GpsTrackingContextResponseDto,
} from "./dto/gps-tracking-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { GpsLogRepository, type NewGpsLog } from "./gps-log.repository";
import {
	type CamperParticipation,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	GpsParticipationSource,
	type TrackedTrip,
} from "./gps-participation.source";
import {
	GPS_LOGGING_INTERVAL_SECONDS,
	GPS_SAMPLING_INTERVAL_SECONDS,
	GPS_TRACKING_CONFIG_VERSION,
} from "./gps-tracking.constants";
import {
	GpsLogIngestStatus,
	GpsLogRejectionReason,
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "./gps-tracking.enums";

type Participant =
	| { role: GpsParticipantRole.CAMPER; camper: CamperParticipation }
	| { role: GpsParticipantRole.PORTER; assigned: boolean };

/** Trip states in which already-captured breadcrumbs may still be synchronized. */
const SYNC_ACCEPTING_TRIP_STATUSES: ReadonlySet<TripStatus> = new Set([
	TripStatus.ONGOING,
	TripStatus.COMPLETED,
]);

/** Camper states that have actually taken part in the Trip. */
const PARTICIPATED_MEMBER_STATUSES: ReadonlySet<BookingMemberStatus> = new Set([
	BookingMemberStatus.JOINED,
	BookingMemberStatus.LEFT,
]);

@Injectable()
export class GpsTrackingService {
	constructor(
		private readonly participation: GpsParticipationSource,
		private readonly gpsLogs: GpsLogRepository
	) {}

	/** BR-237 live check: may the caller record breadcrumbs for this Trip right now? */
	async getTrackingContext(userId: string, tripId: string): Promise<GpsTrackingContextResponseDto> {
		const { trip, participant } = await this.resolveParticipant(userId, tripId);
		const reason = this.liveIneligibilityReason(trip, participant);
		return {
			tripId,
			eligible: reason === null,
			reason,
			participantRole: participant.role,
			samplingIntervalSeconds: GPS_SAMPLING_INTERVAL_SECONDS,
			loggingIntervalSeconds: GPS_LOGGING_INTERVAL_SECONDS,
			configVersion: GPS_TRACKING_CONFIG_VERSION,
		};
	}

	/**
	 * Accepts synchronized breadcrumbs idempotently (BR-244). Each log gets its own
	 * outcome so one invalid log never blocks the rest of the client's buffer.
	 */
	async ingestLogs(
		userId: string,
		tripId: string,
		dto: CreateGpsLogsDto
	): Promise<GpsLogIngestResponseDto> {
		const { trip, participant } = await this.resolveParticipant(userId, tripId);
		const outcomeById = new Map<string, GpsLogIngestResultDto>();
		const candidates: NewGpsLog[] = [];
		const seenIds = new Set<string>();

		for (const log of dto.logs) {
			// A UUID repeated inside one batch is evaluated once and shares that outcome.
			if (seenIds.has(log.id)) {
				continue;
			}
			seenIds.add(log.id);
			const rejection = this.syncRejectionReason(trip, participant, log);
			if (rejection) {
				outcomeById.set(log.id, rejected(log.id, rejection));
				continue;
			}
			candidates.push(toNewGpsLog(log, tripId, userId, participant.role));
		}

		const insertedIds = await this.gpsLogs.insertIgnoringExisting(candidates);
		const existingIds = candidates.map((log) => log.id).filter((id) => !insertedIds.has(id));
		const owners = await this.gpsLogs.findOwners(existingIds);

		for (const log of candidates) {
			if (insertedIds.has(log.id)) {
				outcomeById.set(log.id, { id: log.id, status: GpsLogIngestStatus.ACCEPTED, reason: null });
				continue;
			}
			const owner = owners.get(log.id);
			const isOwnRetry = owner?.userId === userId && owner.tripId === tripId;
			outcomeById.set(
				log.id,
				isOwnRetry
					? { id: log.id, status: GpsLogIngestStatus.DUPLICATE, reason: null }
					: rejected(log.id, GpsLogRejectionReason.ID_CONFLICT)
			);
		}

		return { results: dto.logs.map((log) => outcomeById.get(log.id) as GpsLogIngestResultDto) };
	}

	private async resolveParticipant(
		userId: string,
		tripId: string
	): Promise<{ trip: TrackedTrip; participant: Participant }> {
		const trip = await this.participation.findTrip(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(tripId, userId),
			this.participation.findPorterAssignment(tripId, userId),
		]);
		const participant = pickParticipant(camper, porter);
		if (!participant) {
			throw new ForbiddenException("You are not a participant of this Trip");
		}
		return { trip, participant };
	}

	private liveIneligibilityReason(
		trip: TrackedTrip,
		participant: Participant
	): GpsTrackingIneligibleReason | null {
		if (trip.status !== TripStatus.ONGOING) {
			return GpsTrackingIneligibleReason.TRIP_NOT_ONGOING;
		}
		if (participant.role === GpsParticipantRole.CAMPER) {
			return participant.camper.memberStatus === BookingMemberStatus.JOINED
				? null
				: GpsTrackingIneligibleReason.CAMPER_NOT_JOINED;
		}
		return participant.assigned ? null : GpsTrackingIneligibleReason.PORTER_NOT_ASSIGNED;
	}

	/**
	 * A late-synchronized log is accepted only if it was captured while the caller
	 * was actually taking part in the Trip: within the scheduled Trip window and,
	 * for a Camper, after check-in and before leaving.
	 */
	private syncRejectionReason(
		trip: TrackedTrip,
		participant: Participant,
		log: GpsLogInputDto
	): GpsLogRejectionReason | null {
		if (!SYNC_ACCEPTING_TRIP_STATUSES.has(trip.status)) {
			return GpsLogRejectionReason.TRIP_NOT_TRACKABLE;
		}

		let windowStart = trip.startsAt.getTime();
		let windowEnd = trip.endsAt.getTime();
		if (participant.role === GpsParticipantRole.CAMPER) {
			const { memberStatus, checkedInAt, leftAt } = participant.camper;
			if (!PARTICIPATED_MEMBER_STATUSES.has(memberStatus)) {
				return GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE;
			}
			if (checkedInAt) {
				windowStart = Math.max(windowStart, checkedInAt.getTime());
			}
			if (memberStatus === BookingMemberStatus.LEFT && leftAt) {
				windowEnd = Math.min(windowEnd, leftAt.getTime());
			}
		} else if (!participant.assigned) {
			return GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE;
		}

		const eventTime = Date.parse(log.eventTime);
		return eventTime >= windowStart && eventTime <= windowEnd
			? null
			: GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION;
	}
}

/** A user linked to the Trip both ways is treated in whichever capacity currently allows tracking. */
function pickParticipant(
	camper: CamperParticipation | null,
	porter: { assigned: boolean } | null
): Participant | null {
	const asCamper: Participant | null = camper ? { role: GpsParticipantRole.CAMPER, camper } : null;
	const asPorter: Participant | null = porter
		? { role: GpsParticipantRole.PORTER, assigned: porter.assigned }
		: null;
	if (camper?.memberStatus === BookingMemberStatus.JOINED) {
		return asCamper;
	}
	if (porter?.assigned) {
		return asPorter;
	}
	return asCamper ?? asPorter;
}

function rejected(id: string, reason: GpsLogRejectionReason): GpsLogIngestResultDto {
	return { id, status: GpsLogIngestStatus.REJECTED, reason };
}

function toNewGpsLog(
	log: GpsLogInputDto,
	tripId: string,
	userId: string,
	participantRole: GpsParticipantRole
): NewGpsLog {
	return {
		id: log.id,
		tripId,
		userId,
		participantRole,
		eventTime: log.eventTime,
		latitude: log.latitude,
		longitude: log.longitude,
		accuracyMeters: log.accuracyMeters,
		altitudeMeters: log.altitudeMeters ?? null,
		batteryLevel: log.batteryLevel ?? null,
		packageVersion: log.packageVersion ?? null,
		configVersion: log.configVersion,
	};
}
