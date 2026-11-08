/** CTMS-081 alert types; mirrors the API enum `emergency_alert_type` (spec §12). */
export type EmergencyAlertType =
	| "severe_weather"
	| "evacuation"
	| "route_hazard"
	| "medical"
	| "security"
	| "other";

export interface EmergencyBroadcast {
	id: string;
	tripId: string;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
	/** Number of addressed members/Porters; only returned to the managing Host. */
	recipientCount: number | null;
	createdAt: string;
}

export interface CreateEmergencyBroadcastInput {
	/** Client-generated UUID: resending the same draft never creates a second broadcast. */
	id: string;
	alertType: EmergencyAlertType;
	content: string;
}

/** Payload of the `emergency.broadcast` socket event (CTMS-081-T01 §13). */
export interface EmergencyBroadcastEvent {
	eventId: string;
	broadcastId: string;
	tripId: string;
	tripTitle: string | null;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
	createdAt: string;
}
