import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CreateEmergencyBroadcastInput, EmergencyBroadcast } from "../types";

export interface EmergencyBroadcastsService {
	list(tripId: string): Promise<EmergencyBroadcast[]>;
	create(tripId: string, input: CreateEmergencyBroadcastInput): Promise<EmergencyBroadcast>;
}

export const emergencyBroadcastsService: EmergencyBroadcastsService = {
	list: (tripId) =>
		httpClient.get<EmergencyBroadcast[]>(API_ENDPOINTS.TRIPS.EMERGENCY_BROADCASTS(tripId)),
	create: (tripId, input) =>
		httpClient.post<EmergencyBroadcast>(API_ENDPOINTS.TRIPS.EMERGENCY_BROADCASTS(tripId), input),
};
