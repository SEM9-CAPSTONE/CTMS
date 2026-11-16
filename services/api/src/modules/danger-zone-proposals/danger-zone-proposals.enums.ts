/** Where a proposal came from. Neither source publishes anything until an Admin approves it. */
export enum DangerZoneProposalSource {
	HOST = "HOST",
	INCIDENT = "INCIDENT",
}

export enum DangerZoneProposalStatus {
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
}

export enum DangerZoneHazardType {
	ROUTE_OBSTRUCTION = "ROUTE_OBSTRUCTION",
	LOST_MEMBER = "LOST_MEMBER",
	SLIPPERY_OR_LANDSLIDE = "SLIPPERY_OR_LANDSLIDE",
	DAMAGED_BARRIER = "DAMAGED_BARRIER",
	WILDLIFE = "WILDLIFE",
	OTHER = "OTHER",
}

export enum DangerZoneProposalErrorCode {
	PROPOSAL_NOT_FOUND = "PROPOSAL_NOT_FOUND",
	PROPOSAL_ALREADY_DECIDED = "PROPOSAL_ALREADY_DECIDED",
	RADIUS_NOT_ALLOWED = "RADIUS_NOT_ALLOWED",
	RADIUS_REQUIRED = "RADIUS_REQUIRED",
}
