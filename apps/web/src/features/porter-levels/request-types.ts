import type { LevelDecision, LevelQualification, PorterLevel, ReviewContext } from "./types";
export type RequestStatus = "pending" | "needs_info" | "approved" | "rejected" | "cancelled";
export interface LevelRequest {
	id: string;
	qualificationId: string;
	porterId: string;
	routeId: string;
	routeName: string;
	porterName: string | null;
	currentLevel: PorterLevel;
	currentVerified: boolean;
	targetLevel: PorterLevel;
	reason: string;
	status: RequestStatus;
	version: number;
	decisionReason: string | null;
	decidedBy: string | null;
	decidedAt: string | null;
	createdAt: string;
}
export interface RequestEvidence {
	id: string;
	requestId: string;
	fileName: string;
	mimeType: string;
	size: number;
	checksum: string;
	removedAt: string | null;
}
export interface RequestEvent {
	actorName?: string | null;
	id: string;
	actorId: string;
	action: string;
	fromStatus: RequestStatus | null;
	toStatus: RequestStatus;
	reason: string | null;
	createdAt: string;
}
export interface RequestDetail extends ReviewContext {
	decision?: LevelDecision | null;
	request: LevelRequest;
	evidence: RequestEvidence[];
	events: RequestEvent[];
}
export interface RequestFilters {
	search?: string;
	page: number;
	status?: RequestStatus;
	routeId?: string;
	porterId?: string;
}
export interface RequestList {
	items: LevelRequest[];
	total: number;
}
export interface OwnQualification extends LevelQualification {
	openRequestId: string | null;
}
export interface CreateRequestInput {
	routeId: string;
	targetLevel: PorterLevel;
	reason: string;
	expectedQualificationVersion: number;
	files: File[];
}
export interface RequestReviewInput {
	action: "approve" | "reject" | "request-info";
	reason: string;
	expectedVersion: number;
	expectedQualificationVersion?: number;
	expectedPolicyVersion?: number;
	expectedDossierHash?: string;
}
export interface LevelNotification {
	id: string;
	payload: {
		kind: string;
		requestId?: string;
		qualificationId: string;
		routeId: string;
		routeName?: string;
		level: PorterLevel;
		reason: string;
	};
	createdAt: string;
	readAt: string | null;
}
