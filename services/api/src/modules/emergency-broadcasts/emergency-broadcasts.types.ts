/** CTMS-081: approved MVP alert types (spec §12 Pending Decision, may be revised by data design). */
export enum EmergencyAlertType {
	SEVERE_WEATHER = "severe_weather",
	EVACUATION = "evacuation",
	ROUTE_HAZARD = "route_hazard",
	MEDICAL = "medical",
	SECURITY = "security",
	OTHER = "other",
}

export enum EmergencyBroadcastRecipientRole {
	CAMPER = "camper",
	PORTER = "porter",
}

export const EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH = 1000;

export interface BroadcastTrip {
	id: string;
	hostId: string;
	status: string;
	title: string;
}

export interface BroadcastRecipient {
	userId: string;
	role: EmergencyBroadcastRecipientRole;
}

export interface EmergencyBroadcast {
	id: string;
	tripId: string;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
	recipientCount: number;
	createdAt: Date;
}

export interface EmergencyBroadcastView {
	id: string;
	tripId: string;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
	/** Host only; null for recipients, who do not see the audience size. */
	recipientCount: number | null;
	createdAt: string;
}

/** Realtime payload; `eventId` equals the broadcast ID so clients can drop redeliveries. */
export interface EmergencyBroadcastPayload {
	eventId: string;
	broadcastId: string;
	tripId: string;
	tripTitle: string;
	hostId: string;
	alertType: EmergencyAlertType;
	content: string;
	createdAt: string;
}
