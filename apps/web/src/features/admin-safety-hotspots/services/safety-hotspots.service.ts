import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CorrectiveAction,
	CorrectiveTargets,
	CreateCorrectiveActionPayload,
	HotspotEvidenceEvent,
	HotspotReview,
	HotspotReviewTarget,
	HotspotStatusFilter,
	SafetyHotspot,
} from "../types";

export const safetyHotspotsService = {
	list: (status: HotspotStatusFilter): Promise<SafetyHotspot[]> =>
		httpClient.get<SafetyHotspot[]>(
			API_ENDPOINTS.SAFETY_HOTSPOTS.LIST,
			status === "ALL" ? { limit: 200 } : { status, limit: 200 }
		),
	evidence: (id: string): Promise<HotspotEvidenceEvent[]> =>
		httpClient.get<HotspotEvidenceEvent[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.EVIDENCE(id)),
	targets: (id: string): Promise<CorrectiveTargets> =>
		httpClient.get<CorrectiveTargets>(API_ENDPOINTS.SAFETY_HOTSPOTS.TARGETS(id)),
	actions: (id: string): Promise<CorrectiveAction[]> =>
		httpClient.get<CorrectiveAction[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.ACTIONS(id)),
	createAction: (id: string, payload: CreateCorrectiveActionPayload): Promise<CorrectiveAction> =>
		httpClient.post<CorrectiveAction>(API_ENDPOINTS.SAFETY_HOTSPOTS.ACTIONS(id), payload),
	review: (id: string, status: HotspotReviewTarget, reason: string): Promise<SafetyHotspot> =>
		httpClient.post<SafetyHotspot>(API_ENDPOINTS.SAFETY_HOTSPOTS.REVIEW(id), { status, reason }),
	reviews: (id: string): Promise<HotspotReview[]> =>
		httpClient.get<HotspotReview[]>(API_ENDPOINTS.SAFETY_HOTSPOTS.REVIEWS(id)),
};
