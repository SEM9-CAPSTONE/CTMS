import { HttpError } from "../../../core/api";
import { INCIDENT_RETRY_BASE_DELAY_MS, INCIDENT_RETRY_MAX_DELAY_MS } from "../constants";
import type { TripIncidentsApi } from "../services/trip-incidents.service";
import {
	type IncidentListItem,
	IncidentMediaState,
	IncidentSyncState,
	type LocalIncidentRecord,
	type TripIncident,
} from "../types";

export interface SyncFailure {
	retryable: boolean;
	reason: string;
}

const incidentErrorReasons: Record<string, string> = {
	INCIDENT_TRIP_NOT_IN_PROGRESS: "Chuyến đi không ở trạng thái cho phép báo cáo sự cố.",
	INCIDENT_OUTSIDE_TRIP_WINDOW: "Thời điểm sự cố nằm ngoài thời gian của chuyến đi.",
	INCIDENT_ID_CONFLICT: "Mã sự cố bị trùng với một báo cáo khác.",
	INCIDENT_MEDIA_INVALID: "Ảnh phải là JPEG, PNG hoặc WebP và không quá 5 MB.",
};

function errorCode(error: HttpError): string | null {
	const data = error.errorData;
	if (data && typeof data === "object" && "code" in data && typeof data.code === "string") {
		return data.code;
	}
	return null;
}

/**
 * Network problems, expired sessions and server hiccups are retried later; anything the
 * server refused on business or validation grounds is final and shown to the Porter.
 */
export function classifySyncError(error: unknown): SyncFailure {
	if (!(error instanceof HttpError)) {
		return { retryable: true, reason: "Không có kết nối tới máy chủ." };
	}
	const code = errorCode(error);
	const knownReason = code ? incidentErrorReasons[code] : undefined;
	switch (true) {
		case error.status === 401:
			return { retryable: true, reason: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
		case error.status === 408 || error.status === 429 || error.status >= 500:
			return { retryable: true, reason: "Máy chủ tạm thời không phản hồi." };
		case error.status === 403:
			return { retryable: false, reason: "Bạn không còn được phân công cho chuyến đi này." };
		case error.status === 404:
			return { retryable: false, reason: "Không tìm thấy chuyến đi hoặc sự cố." };
		case error.status === 413:
			return { retryable: false, reason: incidentErrorReasons.INCIDENT_MEDIA_INVALID };
		default:
			return { retryable: false, reason: knownReason ?? error.message };
	}
}

export function nextRetryDelayMs(attempts: number): number {
	return Math.min(INCIDENT_RETRY_BASE_DELAY_MS * 2 ** attempts, INCIDENT_RETRY_MAX_DELAY_MS);
}

function isDue(record: LocalIncidentRecord, now: number): boolean {
	return record.nextAttemptAt === null || record.nextAttemptAt <= now;
}

/** Whether the record still has an incident or photo waiting to be sent right now. */
export function needsSync(record: LocalIncidentRecord, now: number): boolean {
	if (record.syncState === IncidentSyncState.PENDING) return isDue(record, now);
	return (
		record.syncState === IncidentSyncState.SYNCED &&
		record.mediaState === IncidentMediaState.PENDING &&
		isDue(record, now)
	);
}

function withFailure(
	record: LocalIncidentRecord,
	failure: SyncFailure,
	now: number,
	onFinal: Partial<LocalIncidentRecord>
): LocalIncidentRecord {
	if (failure.retryable) {
		return {
			...record,
			attempts: record.attempts + 1,
			nextAttemptAt: now + nextRetryDelayMs(record.attempts),
			lastError: failure.reason,
		};
	}
	return { ...record, ...onFinal, nextAttemptAt: null, lastError: failure.reason };
}

function afterIncidentSynced(
	record: LocalIncidentRecord,
	incident: TripIncident
): LocalIncidentRecord {
	const mediaState = incident.media
		? IncidentMediaState.UPLOADED
		: record.photo
			? IncidentMediaState.PENDING
			: IncidentMediaState.NONE;
	return {
		...record,
		syncState: IncidentSyncState.SYNCED,
		mediaState,
		serverIncident: incident,
		attempts: 0,
		nextAttemptAt: null,
		lastError: null,
	};
}

/**
 * Sends one record: the incident first, then its photo. The client-generated id makes
 * every resend idempotent, so a lost response is simply retried (AC4).
 */
export async function syncIncidentRecord(
	record: LocalIncidentRecord,
	api: TripIncidentsApi,
	now: number,
	isActive: () => boolean = () => true
): Promise<LocalIncidentRecord> {
	let current = record;
	if (!isActive()) return current;
	if (current.syncState !== IncidentSyncState.SYNCED) {
		try {
			const result = await api.report(current.tripId, current.payload);
			current = afterIncidentSynced(current, result.incident);
		} catch (error) {
			return withFailure(current, classifySyncError(error), now, {
				syncState: IncidentSyncState.FAILED,
			});
		}
	}

	if (current.mediaState !== IncidentMediaState.PENDING || !current.photo) {
		return current;
	}
	if (!isActive()) return current;
	try {
		const incident = await api.uploadMedia(current.tripId, current.id, current.photo);
		return {
			...current,
			mediaState: IncidentMediaState.UPLOADED,
			serverIncident: incident,
			photo: null,
		};
	} catch (error) {
		// A photo failure never touches the already-synchronized incident (BR-224).
		return withFailure(current, classifySyncError(error), now, {
			mediaState: IncidentMediaState.FAILED,
		});
	}
}

/** Whether the device copy can be dropped because the server list already holds it. */
export function isSettled(record: LocalIncidentRecord): boolean {
	return (
		record.syncState === IncidentSyncState.SYNCED &&
		(record.mediaState === IncidentMediaState.NONE ||
			record.mediaState === IncidentMediaState.UPLOADED)
	);
}

function fromServer(incident: TripIncident): IncidentListItem {
	return {
		id: incident.id,
		category: incident.category,
		severity: incident.severity,
		description: incident.description,
		occurredAt: incident.occurredAt,
		location: incident.location,
		locationStatus: incident.locationStatus,
		syncState: IncidentSyncState.SYNCED,
		mediaState: incident.media ? IncidentMediaState.UPLOADED : IncidentMediaState.NONE,
		mediaUrl: incident.media?.url ?? null,
		lastError: null,
	};
}

function fromDevice(record: LocalIncidentRecord): IncidentListItem {
	const server = record.serverIncident;
	return {
		...(server
			? fromServer(server)
			: {
					id: record.id,
					category: record.payload.category,
					severity: record.payload.severity,
					description: record.payload.description,
					occurredAt: record.payload.occurredAt,
					location: record.payload.location,
					locationStatus: null,
					mediaUrl: null,
				}),
		syncState: record.syncState,
		mediaState: record.mediaState,
		lastError: record.lastError,
	};
}

/** Device records win while they still carry unsent work; the server is authoritative otherwise. */
export function mergeIncidentLists(
	serverIncidents: TripIncident[],
	records: LocalIncidentRecord[]
): IncidentListItem[] {
	const items = new Map<string, IncidentListItem>();
	for (const incident of serverIncidents) items.set(incident.id, fromServer(incident));
	for (const record of records) {
		if (!(items.has(record.id) && isSettled(record))) items.set(record.id, fromDevice(record));
	}
	return [...items.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
