import type { ScheduleStatus } from "../schedule-progress/types";

/** CTMS-066 `GET /trips/:tripId/member-locations` contract (CTMS-329, spec §13). */
export type LocationFreshness = "fresh" | "stale" | "unavailable";

export interface SyncedSafetyTransition {
	type: "OFF_ROUTE" | "ON_ROUTE_RECOVERED" | "GPS_DEGRADED" | "GPS_RESTORED";
	eventTime: string;
	receivedAt: string;
}

export interface MemberLocation {
	id: string;
	userId: string | null;
	name: string | null;
	role: "camper" | "porter";
	memberStatus: "joined" | "left" | null;
	location: {
		id: string;
		latitude: number;
		longitude: number;
		accuracyMeters: number;
		eventTime: string;
		receivedAt: string;
	} | null;
	lastSeenAt: string | null;
	lastSyncedAt: string | null;
	freshness: LocationFreshness;
	locationAgeSeconds: number | null;
	safety: {
		route: SyncedSafetyTransition | null;
		gps: SyncedSafetyTransition | null;
		lastCheckpoint: {
			checkpointId: string;
			checkpointName: string;
			arrivedAt: string;
			receivedAt: string;
		} | null;
		behindSchedule: {
			status: ScheduleStatus;
			lagMinutes: number | null;
			reference: { checkpointId: string; checkpointName: string; porterArrivedAt: string } | null;
			safeCheckpoint: { id: string; name: string; type: string } | null;
			evaluatedAt: string;
		} | null;
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
