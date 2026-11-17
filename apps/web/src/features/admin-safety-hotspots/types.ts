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

export interface CheckpointTarget {
	id: string;
	name: string;
	routePosition: number;
	instructions: string;
}

export interface HazardAreaTarget {
	id: string;
	description: string;
	severity: HazardSeverity;
	geometry:
		| { type: "Point"; coordinates: [number, number] }
		| { type: "Polygon"; coordinates: unknown };
	radiusMeters: number | null;
}

export interface CorrectiveTargets {
	checkpoints: CheckpointTarget[];
	hazardAreas: HazardAreaTarget[];
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

export interface CreateCorrectiveActionPayload {
	actionType: CorrectiveActionType;
	reason: string;
	checkpointId?: string;
	instructions?: string;
	hazardAreaId?: string;
	hazardArea?: {
		geometry: { type: "Point"; coordinates: [number, number] };
		radiusMeters: number;
		description: string;
		severity: HazardSeverity;
	};
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
