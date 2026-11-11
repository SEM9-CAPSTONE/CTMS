import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { HostSosFilterParams, HostSosListResponse, SosAlertItem } from "../types";

export interface SosHandlingService {
	acknowledge(tripId: string, sosId: string): Promise<SosAlertItem>;
	close(tripId: string, sosId: string, resolutionNote: string): Promise<SosAlertItem>;
	listByTrip(tripId: string): Promise<SosAlertItem[]>;
	listForHost(params?: HostSosFilterParams): Promise<HostSosListResponse>;
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
	listForHost: async (params?: HostSosFilterParams): Promise<HostSosListResponse> => {
		const query = new URLSearchParams();
		if (params?.page) query.set("page", String(params.page));
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.status && params.status !== "all") query.set("status", params.status);
		if (params?.tripId) query.set("tripId", params.tripId);
		if (params?.search?.trim()) query.set("search", params.search.trim());

		const qs = query.toString();
		const endpoint = qs ? `${API_ENDPOINTS.SOS.HOST_SOS}?${qs}` : API_ENDPOINTS.SOS.HOST_SOS;
		return httpClient.get<HostSosListResponse>(endpoint);
	},
};
