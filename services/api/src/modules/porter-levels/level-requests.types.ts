import type { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
export enum LevelRequestStatus {
	PENDING = "pending",
	NEEDS_INFO = "needs_info",
	APPROVED = "approved",
	REJECTED = "rejected",
	CANCELLED = "cancelled",
}
export interface LevelRequest {
	id: string;
	qualificationId: string;
	porterId: string;
	routeId: string;
	currentLevel: PorterRouteProficiency;
	currentVerified: boolean;
	targetLevel: PorterRouteProficiency;
	reason: string;
	status: LevelRequestStatus;
	version: number;
	submissionHash: string;
	decisionReason: string | null;
	decidedBy: string | null;
	decidedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	porterName: string | null;
	routeName: string;
}
export interface RequestEvidence {
	id: string;
	requestId: string;
	fileRef: string;
	fileName: string;
	mimeType: string;
	size: number;
	checksum: string;
	uploadedAt: Date;
	removedAt: Date | null;
}
export interface RequestEvent {
	id: string;
	actorId: string;
	action: string;
	fromStatus: LevelRequestStatus | null;
	toStatus: LevelRequestStatus;
	reason: string | null;
	snapshot: unknown;
	createdAt: Date;
}
export interface LevelNotification {
	id: string;
	payload: {
		kind: string;
		requestId?: string;
		qualificationId: string;
		routeId: string;
		routeName?: string;
		level: string;
		reason: string;
	};
	createdAt: Date;
	readAt: Date | null;
}
export const LEVEL_REQUEST_SELECT = `SELECT x.id,x.qualification_id AS "qualificationId",x.porter_id AS "porterId",x.route_id AS "routeId",
 x.current_level AS "currentLevel",x.current_verified AS "currentVerified",x.target_level AS "targetLevel",x.reason,x.status,x.version,
 x.submission_hash AS "submissionHash",x.decision_reason AS "decisionReason",x.decided_by AS "decidedBy",x.decided_at AS "decidedAt",
 x.created_at AS "createdAt",x.updated_at AS "updatedAt",u.full_name AS "porterName",r.name AS "routeName"
 FROM porter_level_requests x JOIN users u ON u.id=x.porter_id JOIN trekking_routes r ON r.id=x.route_id`;
export const REQUEST_EVIDENCE_SELECT = `SELECT id,request_id AS "requestId",file_ref AS "fileRef",file_name AS "fileName",mime_type AS "mimeType",size,checksum,uploaded_at AS "uploadedAt",removed_at AS "removedAt" FROM porter_level_request_evidence`;
