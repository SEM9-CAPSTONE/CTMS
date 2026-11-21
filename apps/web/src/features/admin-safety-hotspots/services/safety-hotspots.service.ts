import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CorrectiveAction,
	HotspotEvidenceEvent,
	HotspotReview,
	HotspotReviewTarget,
	HotspotStatusFilter,
	SafetyHotspot,
	UpdateHotspotPayload,
} from "../types";

export const safetyHotspotsService = {
	list: (status: HotspotStatusFilter): Promise<SafetyHotspot[]> =>
		httpClient.get<SafetyHotspot[]>(
			API_ENDPOINTS.SAFETY_HOTSPOTS.LIST,
			status === "ALL" ? { limit: 200 } : { status, limit: 200 }
		),
	evidence: (id: string): Promise<HotspotEvidenceEvent[]> =>
		httpClient.get<HotspotEvidenceEvent[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.EVIDENCE(id)),
	actions: (id: string): Promise<CorrectiveAction[]> =>
		httpClient.get<CorrectiveAction[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.ACTIONS(id)),
	update: (id: string, payload: UpdateHotspotPayload): Promise<SafetyHotspot> =>
		httpClient.patch<SafetyHotspot>(API_ENDPOINTS.SAFETY_HOTSPOTS.DETAIL(id), payload),
	remove: (id: string): Promise<void> =>
		httpClient.delete<void>(API_ENDPOINTS.SAFETY_HOTSPOTS.DETAIL(id)),
	review: (id: string, status: HotspotReviewTarget, reason: string): Promise<SafetyHotspot> =>
		httpClient.post<SafetyHotspot>(API_ENDPOINTS.SAFETY_HOTSPOTS.REVIEW(id), { status, reason }),
	reviews: (id: string): Promise<HotspotReview[]> =>
		httpClient.get<HotspotReview[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.REVIEWS(id)),
};
