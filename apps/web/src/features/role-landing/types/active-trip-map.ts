import type { GeoJsonLineString, RouteCheckpoint } from "../../trekking-routes/types";

export interface ParticipantSelection {
	tripId: string;
	role: "camper" | "porter";
	participantId: string;
}

export interface MapParticipant {
	id: string;
	role: ParticipantSelection["role"];
	name: string | null;
	location: { latitude: number; longitude: number } | null;
	lastSeenAt: string | null;
	freshness: "fresh" | "stale" | "unavailable";
	safety: {
		route: { type: string; eventTime: string } | null;
		gps: { type: string; eventTime: string } | null;
	};
}

export interface ActiveTripMap {
	id: string;
	route: {
		name: string;
		geometry: GeoJsonLineString;
		checkpoints: Pick<RouteCheckpoint, "id" | "type" | "location">[];
	};
	participants: MapParticipant[];
}
