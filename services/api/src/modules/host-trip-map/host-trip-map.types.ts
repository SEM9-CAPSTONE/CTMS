import type { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import type { SafetyEventType } from "../safety-events/safety-events.enums";
import type { CheckpointType, GeoPoint } from "../trekking-routes/entities/checkpoint.entity";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";

export enum LocationFreshness {
	FRESH = "fresh",
	STALE = "stale",
	UNAVAILABLE = "unavailable",
}

export interface SyncedLocation {
	id: string;
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	eventTime: string;
	receivedAt: string;
}

export interface SyncedSafetyTransition {
	type: SafetyEventType;
	eventTime: string;
	receivedAt: string;
}

export interface MapParticipantRow {
	id: string;
	userId: string | null;
	name: string | null;
	role: GpsParticipantRole;
	memberStatus: BookingMemberStatus | null;
	location: SyncedLocation | null;
	safety: {
		route: SyncedSafetyTransition | null;
		gps: SyncedSafetyTransition | null;
		lastCheckpoint: { checkpointId: string; arrivedAt: string; receivedAt: string } | null;
		behindSchedule: null;
	};
}

export interface MapParticipant extends MapParticipantRow {
	lastSeenAt: string | null;
	freshness: LocationFreshness;
	locationAgeSeconds: number | null;
}

export interface MapTripRow {
	id: string;
	title: string;
	startsAt: string;
	endsAt: string;
	route: {
		id: string;
		name: string;
		geometry: GeoLineString;
		checkpoints: Array<{
			id: string;
			name: string;
			type: CheckpointType;
			location: GeoPoint;
			radiusMeters: number;
			routePosition: number;
		}>;
	};
	participants: MapParticipantRow[];
}

export interface MapTrip extends Omit<MapTripRow, "participants"> {
	participants: MapParticipant[];
}

export interface MapPage<T> {
	total: number;
	items: T[];
}

export interface HostTripMap extends MapPage<MapTrip> {
	generatedAt: string;
	freshnessMaxAgeSeconds: number;
	locationSource: "server_confirmed";
	page: number;
	limit: number;
}
