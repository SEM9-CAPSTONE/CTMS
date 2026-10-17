/** Mirrors the API `incident_category` enum (CTMS-049). */
export const INCIDENT_CATEGORIES = [
	"injury",
	"illness",
	"lost_member",
	"equipment_failure",
	"weather_hazard",
	"route_obstruction",
	"wildlife",
	"other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export type IncidentLocationStatus = "fresh" | "stale" | "unavailable";

export interface IncidentLocation {
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	capturedAt: string;
}

export interface TripIncidentMedia {
	url: string;
	contentType: string;
	sizeBytes: number;
	uploadedAt: string;
}

/** Authoritative incident as returned by the API. */
export interface TripIncident {
	id: string;
	tripId: string;
	reporterId: string;
	reporterName: string | null;
	category: IncidentCategory;
	severity: IncidentSeverity;
	status: "open";
	description: string;
	occurredAt: string;
	location: IncidentLocation | null;
	locationStatus: IncidentLocationStatus;
	capturedOffline: boolean;
	media: TripIncidentMedia | null;
	receivedAt: string;
}

export interface ReportIncidentPayload {
	id: string;
	category: IncidentCategory;
	severity: IncidentSeverity;
	description: string;
	occurredAt: string;
	location: IncidentLocation | null;
	capturedOffline: boolean;
}

export interface ReportIncidentResult {
	outcome: "created" | "duplicate";
	incident: TripIncident;
}

export interface TripIncidentList {
	items: TripIncident[];
}

/** Where an incident stands between the device and the server (AC5). */
export const IncidentSyncState = {
	PENDING: "pending",
	SYNCING: "syncing",
	SYNCED: "synced",
	FAILED: "failed",
} as const;
export type IncidentSyncState = (typeof IncidentSyncState)[keyof typeof IncidentSyncState];

/** The optional photo is synchronized separately so its failure never blocks the incident. */
export const IncidentMediaState = {
	NONE: "none",
	PENDING: "pending",
	UPLOADED: "uploaded",
	FAILED: "failed",
} as const;
export type IncidentMediaState = (typeof IncidentMediaState)[keyof typeof IncidentMediaState];

/** One incident kept on the device until the server has confirmed it. */
export interface LocalIncidentRecord {
	id: string;
	tripId: string;
	porterId: string;
	payload: ReportIncidentPayload;
	photo: Blob | null;
	syncState: IncidentSyncState;
	mediaState: IncidentMediaState;
	attempts: number;
	nextAttemptAt: number | null;
	lastError: string | null;
	savedAt: string;
	serverIncident: TripIncident | null;
}

/** What the incident list renders, whether the data came from the server or the device. */
export interface IncidentListItem {
	id: string;
	category: IncidentCategory;
	severity: IncidentSeverity;
	description: string;
	occurredAt: string;
	location: IncidentLocation | null;
	locationStatus: IncidentLocationStatus | null;
	syncState: IncidentSyncState;
	mediaState: IncidentMediaState;
	mediaUrl: string | null;
	lastError: string | null;
}
