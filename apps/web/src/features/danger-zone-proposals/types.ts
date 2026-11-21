import type {
	GeoJsonLineString,
	GeoJsonPoint,
	RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
} from "../trekking-routes/types";

export type ProposalSource = "HOST" | "INCIDENT";
export type ProposalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ProposalStatusFilter = ProposalStatus | "ALL";
export type ProposalHazardType =
	| "ROUTE_OBSTRUCTION"
	| "LOST_MEMBER"
	| "SLIPPERY_OR_LANDSLIDE"
	| "DAMAGED_BARRIER"
	| "WILDLIFE"
	| "OTHER";

export interface DangerZoneProposal {
	id: string;
	source: ProposalSource;
	status: ProposalStatus;
	hazardType: ProposalHazardType;
	severity: RouteDangerZoneSeverity;
	description: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	locationAccuracyMeters: number | null;
	observedAt: string;
	createdAt: string;
	routeId: string;
	routeName: string;
	routeGeometry: GeoJsonLineString;
	proposerName: string;
	tripTitle: string | null;
	tripStartsAt: string | null;
	reviewerName: string | null;
	reviewedAt: string | null;
	reviewReason: string | null;
	dangerZoneId: string | null;
}

export interface ApproveProposalPayload {
	severity: RouteDangerZoneSeverity;
	description: string;
	radiusMeters?: number;
	reason?: string;
}

export interface CreateProposalPayload {
	hazardType: ProposalHazardType;
	geometry: GeoJsonPoint;
	radiusMeters: number;
	severity: RouteDangerZoneSeverity;
	description: string;
}
