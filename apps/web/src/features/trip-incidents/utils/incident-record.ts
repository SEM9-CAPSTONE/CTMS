import { createUuid } from "../../../shared/utils/uuid";
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
	const id = createUuid();
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
