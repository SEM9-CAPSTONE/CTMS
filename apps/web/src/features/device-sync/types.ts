export const DeviceSyncState = {
	IDLE: "idle",
	PENDING: "pending",
	SYNCING: "syncing",
	PARTIAL_FAILURE: "partial_failure",
	FAILED: "failed",
	SYNCED: "synced",
} as const;

export type DeviceSyncState = (typeof DeviceSyncState)[keyof typeof DeviceSyncState];

export interface LocalGpsLogRecord {
	id: string;
	tripId: string;
	userId: string;
	eventTime: string;
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	altitudeMeters?: number | null;
	batteryLevel?: number | null;
	packageVersion?: string | null;
	configVersion: string;
	syncState: DeviceSyncState;
	lastError?: string | null;
	savedAt: string;
}

export interface MemberSyncHealth {
	userId: string;
	displayName: string;
	role: string;
	gpsCount: number;
	safetyCount: number;
	lastReceivedAt: string | null;
	status: "connected" | "syncing" | "stale";
}

export interface ServerDeviceSyncStatus {
	tripId: string;
	userId: string;
	participantRole: string;
	serverConfirmedGpsCount: number;
	serverConfirmedSafetyCount: number;
	lastReceivedAt: string | null;
	packageVersion: string | null;
	configVersion: string;
	membersSyncHealth?: MemberSyncHealth[];
}

export interface DeviceSyncSummary {
	pendingGpsCount: number;
	failedGpsCount: number;
	pendingSafetyCount: number;
	failedSafetyCount: number;
	serverConfirmedGpsCount: number;
	serverConfirmedSafetyCount: number;
	lastSyncAt: string | null;
	lastError: string | null;
	syncState: DeviceSyncState;
	packageVersion: string | null;
	configVersion: string;
	membersSyncHealth?: MemberSyncHealth[];
}
