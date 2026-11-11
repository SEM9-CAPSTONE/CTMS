import {
	type IncidentCategory,
	type IncidentLocation,
	IncidentMediaState,
	type IncidentSeverity,
	IncidentSyncState,
	type LocalIncidentRecord,
} from "../types";

export interface NewIncidentInput {
	category: IncidentCategory;
	severity: IncidentSeverity;
	description: string;
	occurredAt: string;
	location: IncidentLocation | null;
	photo: Blob | null;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** RFC 4122 v4 id; `randomUUID` is missing outside secure contexts (e.g. plain-HTTP LAN). */
export function generateIncidentId(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = toHex(bytes);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Builds the device copy of a new incident. Its id is fixed here, once, so every later
 * resend is recognized by the server as the same incident (BR-162).
 */
export function createIncidentRecord(
	input: NewIncidentInput,
	tripId: string,
	porterId: string,
	isOnline: boolean,
	savedAt: Date
): LocalIncidentRecord {
	const id = generateIncidentId();
	return {
		id,
		tripId,
		porterId,
		payload: {
			id,
			category: input.category,
			severity: input.severity,
			description: input.description.trim(),
			occurredAt: input.occurredAt,
			location: input.location,
			capturedOffline: !isOnline,
		},
		photo: input.photo,
		syncState: IncidentSyncState.PENDING,
		mediaState: input.photo ? IncidentMediaState.PENDING : IncidentMediaState.NONE,
		attempts: 0,
		nextAttemptAt: null,
		lastError: null,
		savedAt: savedAt.toISOString(),
		serverIncident: null,
	};
}
