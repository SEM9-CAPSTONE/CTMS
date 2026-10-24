import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ServerDeviceSyncStatus } from "../types";

export interface GpsLogPayload {
	id: string;
	eventTime: string;
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	altitudeMeters?: number | null;
	batteryLevel?: number | null;
	packageVersion?: string | null;
	configVersion: string;
}

export interface GpsLogIngestResult {
	id: string;
	status: "accepted" | "duplicate" | "rejected";
	reason?: string | null;
}

export interface GpsLogIngestResponse {
	results: GpsLogIngestResult[];
}

export const deviceSyncService = {
	getServerStatus: async (tripId: string): Promise<ServerDeviceSyncStatus> => {
		return httpClient.get<ServerDeviceSyncStatus>(API_ENDPOINTS.DEVICE_SYNC.STATUS(tripId));
	},

	uploadGpsLogs: async (tripId: string, logs: GpsLogPayload[]): Promise<GpsLogIngestResponse> => {
		return httpClient.post<GpsLogIngestResponse>(API_ENDPOINTS.TRIPS.GPS_LOGS(tripId), { logs });
	},
};
