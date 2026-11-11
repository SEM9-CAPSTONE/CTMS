import { ConflictException, Injectable } from "@nestjs/common";
import {
	type ParticipationRejection,
	liveIneligibilityReason,
	participationRejection,
	resolveTripParticipant,
} from "../gps-tracking/gps-participant";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { GpsLogRejectionReason } from "../gps-tracking/gps-tracking.enums";
import type { CreateSafetyEventsDto, SafetyEventInputDto } from "./dto/create-safety-events.dto";
import type {
	RouteDeviationContextResponseDto,
	SafetyEventIngestResponseDto,
	SafetyEventIngestResultDto,
} from "./dto/safety-events-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	type NewSafetyEvent,
	SafetyEventRepository,
	type TripRoute,
} from "./safety-event.repository";
import {
	GPS_DEGRADED_AFTER_SECONDS,
	OFF_ROUTE_MIN_DISTANCE_METERS,
	ON_ROUTE_MAX_DISTANCE_METERS,
	ROUTE_DEVIATION_CONFIG_VERSION,
	ROUTE_DEVIATION_CONSECUTIVE_SAMPLES,
	VALID_SAMPLE_MAX_ACCURACY_METERS,
} from "./safety-events.constants";
import {
	SafetyEventIngestStatus,
	SafetyEventRejectionReason,
	SafetyEventType,
} from "./safety-events.enums";

const PARTICIPATION_REJECTIONS: Record<ParticipationRejection, SafetyEventRejectionReason> = {
	[GpsLogRejectionReason.TRIP_NOT_TRACKABLE]: SafetyEventRejectionReason.TRIP_NOT_TRACKABLE,
	[GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE]:
		SafetyEventRejectionReason.PARTICIPATION_NOT_ELIGIBLE,
	[GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION]:
		SafetyEventRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION,
};

@Injectable()
export class SafetyEventsService {
	constructor(
		private readonly participation: GpsParticipationSource,
		private readonly safetyEvents: SafetyEventRepository
	) {}

	/**
	 * Everything the device needs to detect route deviation offline (BR-238): the Trip's
	 * authoritative Route geometry with its version, and the fixed V3 thresholds.
	 */
	async getRouteDeviationContext(
		userId: string,
		tripId: string
	): Promise<RouteDeviationContextResponseDto> {
		const { trip, participant } = await resolveTripParticipant(this.participation, userId, tripId);
		const route = await this.requireTripRoute(tripId);
		const reason = liveIneligibilityReason(trip, participant);
		return {
			tripId,
			eligible: reason === null,
			reason,
			participantRole: participant.role,
			routeId: route.routeId,
			routeVersion: route.routeVersion,
			geometry: route.geometry,
			thresholds: {
				validSampleMaxAccuracyMeters: VALID_SAMPLE_MAX_ACCURACY_METERS,
				offRouteMinDistanceMeters: OFF_ROUTE_MIN_DISTANCE_METERS,
				onRouteMaxDistanceMeters: ON_ROUTE_MAX_DISTANCE_METERS,
				consecutiveSamples: ROUTE_DEVIATION_CONSECUTIVE_SAMPLES,
				gpsDegradedAfterSeconds: GPS_DEGRADED_AFTER_SECONDS,
			},
			configVersion: ROUTE_DEVIATION_CONFIG_VERSION,
		};
	}

	/**
	 * Accepts synchronized safety events idempotently (BR-244), keeping the client's
	 * original detection context. The server checks that context against the Trip's Route
	 * and the fixed thresholds but never recomputes the device's detection state.
	 */
	async ingestEvents(
		userId: string,
		tripId: string,
		dto: CreateSafetyEventsDto
	): Promise<SafetyEventIngestResponseDto> {
		const { trip, participant } = await resolveTripParticipant(this.participation, userId, tripId);
		const route = await this.requireTripRoute(tripId);
		const outcomeById = new Map<string, SafetyEventIngestResultDto>();
		const candidates: NewSafetyEvent[] = [];
		const seenIds = new Set<string>();

		for (const event of dto.events) {
			// A UUID repeated inside one batch is evaluated once and shares that outcome.
			if (seenIds.has(event.id)) {
				continue;
			}
			seenIds.add(event.id);
			const participationIssue = participationRejection(trip, participant, event.eventTime);
			const rejection = participationIssue
				? PARTICIPATION_REJECTIONS[participationIssue]
				: integrityRejection(event, route);
			if (rejection) {
				outcomeById.set(event.id, rejected(event.id, rejection));
				continue;
			}
			candidates.push(toNewSafetyEvent(event, tripId, userId, participant.role, route));
		}

		const insertedIds = await this.safetyEvents.insertIgnoringExisting(candidates);
		const existingIds = candidates.map((event) => event.id).filter((id) => !insertedIds.has(id));
		const owners = await this.safetyEvents.findOwners(existingIds);

		for (const event of candidates) {
			if (insertedIds.has(event.id)) {
				outcomeById.set(event.id, {
					id: event.id,
					status: SafetyEventIngestStatus.ACCEPTED,
					reason: null,
				});
				continue;
			}
			const owner = owners.get(event.id);
			const isOwnRetry = owner?.userId === userId && owner.tripId === tripId;
			outcomeById.set(
				event.id,
				isOwnRetry
					? { id: event.id, status: SafetyEventIngestStatus.DUPLICATE, reason: null }
					: rejected(event.id, SafetyEventRejectionReason.ID_CONFLICT)
			);
		}

		return {
			results: dto.events.map((event) => outcomeById.get(event.id) as SafetyEventIngestResultDto),
		};
	}

	private async requireTripRoute(tripId: string): Promise<TripRoute> {
		const route = await this.safetyEvents.findTripRoute(tripId);
		if (!route) {
			throw new ConflictException("Trip has no Route geometry for route-deviation detection");
		}
		return route;
	}
}

/**
 * BR-360/363 and the fixed V3 thresholds: an event is authoritative only if it was
 * detected against the Trip's Route and its own context supports the transition.
 */
function integrityRejection(
	event: SafetyEventInputDto,
	route: TripRoute
): SafetyEventRejectionReason | null {
	if (event.routeVersion !== route.routeVersion) {
		return SafetyEventRejectionReason.ROUTE_VERSION_MISMATCH;
	}
	return meetsThresholds(event) ? null : SafetyEventRejectionReason.THRESHOLD_NOT_MET;
}

function meetsThresholds(event: SafetyEventInputDto): boolean {
	const validSample =
		event.accuracyMeters !== undefined && event.accuracyMeters <= VALID_SAMPLE_MAX_ACCURACY_METERS;
	const confirmed = (event.consecutiveValidSamples ?? 0) >= ROUTE_DEVIATION_CONSECUTIVE_SAMPLES;
	const distance = event.distanceToRouteMeters;
	switch (event.eventType) {
		case SafetyEventType.OFF_ROUTE:
			return (
				validSample &&
				confirmed &&
				distance !== undefined &&
				distance > OFF_ROUTE_MIN_DISTANCE_METERS
			);
		case SafetyEventType.ON_ROUTE_RECOVERED:
			return (
				validSample &&
				confirmed &&
				distance !== undefined &&
				distance < ON_ROUTE_MAX_DISTANCE_METERS
			);
		case SafetyEventType.GPS_DEGRADED: {
			const since = Date.parse(event.noValidSampleSince ?? "");
			return Date.parse(event.eventTime) - since >= GPS_DEGRADED_AFTER_SECONDS * 1000;
		}
		case SafetyEventType.GPS_RESTORED:
			return validSample;
	}
}

function rejected(id: string, reason: SafetyEventRejectionReason): SafetyEventIngestResultDto {
	return { id, status: SafetyEventIngestStatus.REJECTED, reason };
}

function toNewSafetyEvent(
	event: SafetyEventInputDto,
	tripId: string,
	userId: string,
	participantRole: GpsParticipantRole,
	route: TripRoute
): NewSafetyEvent {
	return {
		id: event.id,
		tripId,
		userId,
		participantRole,
		eventType: event.eventType,
		eventTime: event.eventTime,
		latitude: event.latitude ?? null,
		longitude: event.longitude ?? null,
		accuracyMeters: event.accuracyMeters ?? null,
		distanceToRouteMeters: event.distanceToRouteMeters ?? null,
		consecutiveValidSamples: event.consecutiveValidSamples ?? null,
		noValidSampleSince: event.noValidSampleSince ?? null,
		detectedOffline: event.detectedOffline,
		routeId: route.routeId,
		routeVersion: event.routeVersion,
		packageVersion: event.packageVersion ?? null,
		configVersion: event.configVersion,
	};
}
