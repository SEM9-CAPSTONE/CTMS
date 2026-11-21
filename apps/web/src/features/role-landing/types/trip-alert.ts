import type { MapParticipant, ParticipantSelection } from "./active-trip-map";

export type AlertType = "OFF_ROUTE" | "BEHIND_SCHEDULE";
export type AlertSeverity = "BEHIND" | "SEVERELY_BEHIND";
export interface TripAlert {
	participantId: string;
	role: ParticipantSelection["role"];
	name: string | null;
	alertType: AlertType;
	severity: AlertSeverity | null;
	observedAt: string;
	location: MapParticipant["location"];
	lastLocationAt: string | null;
	freshness: MapParticipant["freshness"];
	isStale: boolean;
}
export interface TripAlertsResponse {
	tripId: string;
	generatedAt: string;
	locationSource: "server_confirmed";
	freshnessMaxAgeSeconds: number;
	alerts: TripAlert[];
}
