import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CorrectiveAction,
	CorrectiveTargets,
	CreateCorrectiveActionPayload,
	HotspotStatus,
	SafetyHotspot,
} from "../types";

export const safetyHotspotsService = {
	list: (status: HotspotStatus): Promise<SafetyHotspot[]> =>
		httpClient.get<SafetyHotspot[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.LIST, { status, limit: 200 }),
	targets: (id: string): Promise<CorrectiveTargets> =>
		httpClient.get<CorrectiveTargets>(API_ENDPOINTS.SAFETY_HOTSPOTS.TARGETS(id)),
	actions: (id: string): Promise<CorrectiveAction[]> =>
		httpClient.get<CorrectiveAction[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.ACTIONS(id)),
	createAction: (id: string, payload: CreateCorrectiveActionPayload): Promise<CorrectiveAction> =>
		httpClient.post<CorrectiveAction>(API_ENDPOINTS.SAFETY_HOTSPOTS.ACTIONS(id), payload),
};
