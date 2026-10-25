import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { TripStatus } from "../trips/entities/trip.entity";
import type {
	CamperParticipation,
	GpsParticipationSource,
	TrackedTrip,
} from "./gps-participation.source";
import {
	GpsLogRejectionReason,
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "./gps-tracking.enums";

/**
 * Participation rules shared by every on-device tracking upload (GPS breadcrumbs,
 * CTMS-059, and route-deviation safety events, CTMS-060).
 */
export type Participant =
	| { role: GpsParticipantRole.CAMPER; camper: CamperParticipation }
	| { role: GpsParticipantRole.PORTER; assigned: boolean };

/** Rejections that depend only on the caller's participation, not on the uploaded record. */
export type ParticipationRejection =
	| GpsLogRejectionReason.TRIP_NOT_TRACKABLE
	| GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE
	| GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION;

/** Trip states in which already-captured records may still be synchronized. */
const SYNC_ACCEPTING_TRIP_STATUSES: ReadonlySet<TripStatus> = new Set([
	TripStatus.ONGOING,
	TripStatus.COMPLETED,
]);

/** Camper states that have actually taken part in the Trip. */
const PARTICIPATED_MEMBER_STATUSES: ReadonlySet<BookingMemberStatus> = new Set([
	BookingMemberStatus.JOINED,
	BookingMemberStatus.LEFT,
]);

export async function resolveTripParticipant(
	source: GpsParticipationSource,
	userId: string,
	tripId: string
): Promise<{ trip: TrackedTrip; participant: Participant }> {
	const trip = await source.findTrip(tripId);
	if (!trip) {
		throw new NotFoundException("Trip not found");
	}

	const [camper, porter] = await Promise.all([
		source.findCamperParticipation(tripId, userId),
		source.findPorterAssignment(tripId, userId),
	]);
	const participant = pickParticipant(camper, porter);
	if (!participant) {
		throw new ForbiddenException("You are not a participant of this Trip");
	}
	return { trip, participant };
}

/** BR-237 live check: may the caller track on this Trip right now? */
export function liveIneligibilityReason(
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
 * A late-synchronized record is accepted only if it was captured while the caller
 * was actually taking part in the Trip: within the scheduled Trip window and,
 * for a Camper, after check-in and before leaving.
 */
export function participationRejection(
	trip: TrackedTrip,
	participant: Participant,
	eventTime: string
): ParticipationRejection | null {
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

	const time = Date.parse(eventTime);
	return time >= windowStart && time <= windowEnd
		? null
		: GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION;
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
