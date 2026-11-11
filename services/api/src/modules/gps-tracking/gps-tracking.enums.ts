export enum GpsParticipantRole {
	CAMPER = "camper",
	PORTER = "porter",
}

/** Why live tracking is not allowed right now (GET tracking context). */
export enum GpsTrackingIneligibleReason {
	TRIP_NOT_ONGOING = "TRIP_NOT_ONGOING",
	CAMPER_NOT_JOINED = "CAMPER_NOT_JOINED",
	PORTER_NOT_ASSIGNED = "PORTER_NOT_ASSIGNED",
}

export enum GpsLogIngestStatus {
	ACCEPTED = "accepted",
	DUPLICATE = "duplicate",
	REJECTED = "rejected",
}

/** Why one synchronized log was not stored. Rejections are final; retrying the same log will not help. */
export enum GpsLogRejectionReason {
	TRIP_NOT_TRACKABLE = "TRIP_NOT_TRACKABLE",
	PARTICIPATION_NOT_ELIGIBLE = "PARTICIPATION_NOT_ELIGIBLE",
	EVENT_TIME_OUTSIDE_PARTICIPATION = "EVENT_TIME_OUTSIDE_PARTICIPATION",
	ID_CONFLICT = "ID_CONFLICT",
}
