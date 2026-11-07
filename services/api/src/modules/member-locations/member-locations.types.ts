import type { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import type { SafetyEventType } from "../safety-events/safety-events.enums";
import type { ScheduleStatus } from "../schedule-progress/schedule-progress.evaluator";

/** CTMS-066: how recent the latest server-confirmed capture is. Never a claim of real-time position. */
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
	/** Device capture time. */
	eventTime: string;
	/** When the server accepted the upload. */
	receivedAt: string;
}

export interface SyncedSafetyTransition {
	type: SafetyEventType;
	eventTime: string;
	receivedAt: string;
}

export interface SyncedCheckpointVisit {
	checkpointId: string;
	checkpointName: string;
	arrivedAt: string;
	receivedAt: string;
}

export interface BehindScheduleFlag {
	status: ScheduleStatus;
	lagMinutes: number | null;
	reference: { checkpointId: string; checkpointName: string; porterArrivedAt: string } | null;
	safeCheckpoint: { id: string; name: string; type: string } | null;
	evaluatedAt: string;
}

export interface MemberLocationRow {
	/** Booking-member ID for Campers, user ID for Porters (same identifiers as CTMS-369). */
	id: string;
	userId: string | null;
	name: string | null;
	role: GpsParticipantRole;
	memberStatus: BookingMemberStatus | null;
	location: SyncedLocation | null;
	/** Latest server receipt of any device upload (GPS or device-detected safety event). */
	lastSyncedAt: string | null;
	route: SyncedSafetyTransition | null;
	gps: SyncedSafetyTransition | null;
	lastCheckpoint: SyncedCheckpointVisit | null;
}

export interface MemberLocation {
	id: string;
	userId: string | null;
	name: string | null;
	role: GpsParticipantRole;
	memberStatus: BookingMemberStatus | null;
	location: SyncedLocation | null;
	lastSeenAt: string | null;
	lastSyncedAt: string | null;
	freshness: LocationFreshness;
	locationAgeSeconds: number | null;
	safety: {
		route: SyncedSafetyTransition | null;
		gps: SyncedSafetyTransition | null;
		lastCheckpoint: SyncedCheckpointVisit | null;
		/** Campers only; null = no evaluation available (Porter, guest without account), never "on track". */
		behindSchedule: BehindScheduleFlag | null;
	};
}

export interface TripMemberLocations {
	tripId: string;
	tripStatus: string;
	viewer: "host" | "porter";
	generatedAt: string;
	locationSource: "server_confirmed";
	freshnessMaxAgeSeconds: number;
	members: MemberLocation[];
}

export interface MemberLocationsTrip {
	id: string;
	hostId: string;
	status: string;
}
