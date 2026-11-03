import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { SosAlertItem } from "../types";

export interface SosHandlingService {
	acknowledge(tripId: string, sosId: string): Promise<SosAlertItem>;
	close(tripId: string, sosId: string, resolutionNote: string): Promise<SosAlertItem>;
	listByTrip(tripId: string): Promise<SosAlertItem[]>;
}

export const sosHandlingService: SosHandlingService = {
	acknowledge: async (tripId: string, sosId: string): Promise<SosAlertItem> => {
		return httpClient.patch<SosAlertItem>(API_ENDPOINTS.SOS.ACKNOWLEDGE(tripId, sosId));
	},
	close: async (tripId: string, sosId: string, resolutionNote: string): Promise<SosAlertItem> => {
		return httpClient.patch<SosAlertItem>(API_ENDPOINTS.SOS.CLOSE(tripId, sosId), {
			resolutionNote,
		});
	},
	listByTrip: async (tripId: string): Promise<SosAlertItem[]> => {
		return httpClient.get<SosAlertItem[]>(API_ENDPOINTS.SOS.TRIP_SOS(tripId));
	},
};
