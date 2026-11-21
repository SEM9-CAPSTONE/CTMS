export type HotspotStatus = "DETECTED" | "UNDER_REVIEW" | "CONFIRMED" | "DISMISSED";

export type HotspotStatusFilter = HotspotStatus | "ALL";

export type CorrectiveActionType =
	| "ADD_HAZARD_AREA"
	| "UPDATE_HAZARD_AREA"
	| "UPDATE_CHECKPOINT_INSTRUCTIONS"
	| "NO_DATA_CHANGE"
	| "OTHER";

export type HazardSeverity = "low" | "medium" | "high";

export interface SafetyHotspot {
	id: string;
	routeId: string;
	routeName: string;
	status: HotspotStatus;
	statusChangedAt: string;
	centerLat: number;
	centerLng: number;
	radiusMeters: number;
	eventCount: number;
	distinctTripCount: number;
	distinctMemberCount: number;
	firstEventAt: string;
	lastEventAt: string;
	detectedAt: string;
	/** Written by an Admin; null until the hotspot is edited. */
	name: string | null;
	description: string | null;
	severity: HazardSeverity | null;
}

/** One deviation behind a hotspot; the API never sends which member it was. */
export interface HotspotEvidenceEvent {
	id: string;
	tripTitle: string;
	tripStartsAt: string;
	startedAt: string;
	endedAt: string;
	maxDistanceMeters: number;
}

export interface CorrectiveAction {
	id: string;
	actionType: CorrectiveActionType;
	targetName: string | null;
	reason: string;
	packageImpact: "AFFECTED" | "NOT_AFFECTED";
	impactTripCount: number;
	actorName: string | null;
	createdAt: string;
}

export interface UpdateHotspotPayload {
	name: string;
	description: string;
	severity: HazardSeverity;
}

export type HotspotReviewTarget = "CONFIRMED" | "DISMISSED";

export interface HotspotReview {
	id: string;
	fromStatus: HotspotStatus;
	toStatus: HotspotStatus;
	reason: string;
	actorName: string;
	createdAt: string;
}
