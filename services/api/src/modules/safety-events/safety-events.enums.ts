/** Route-deviation and GPS-quality transitions detected on the device (CTMS-060). */
export enum SafetyEventType {
	/** ON_ROUTE → OFF_ROUTE after 3 consecutive VALID samples > 50 m (BR-377). */
	OFF_ROUTE = "OFF_ROUTE",
	/** OFF_ROUTE → ON_ROUTE after 3 consecutive VALID samples < 20 m (BR-383). */
	ON_ROUTE_RECOVERED = "ON_ROUTE_RECOVERED",
	/** NORMAL → GPS_DEGRADED after no VALID sample for >= 2 minutes (BR-387). */
	GPS_DEGRADED = "GPS_DEGRADED",
	/** GPS_DEGRADED → NORMAL when a VALID sample is received again (BR-388). */
	GPS_RESTORED = "GPS_RESTORED",
}

export enum SafetyEventIngestStatus {
	ACCEPTED = "accepted",
	DUPLICATE = "duplicate",
	REJECTED = "rejected",
}

/** Why one synchronized event was not stored. Rejections are final; retrying the same event will not help. */
export enum SafetyEventRejectionReason {
	TRIP_NOT_TRACKABLE = "TRIP_NOT_TRACKABLE",
	PARTICIPATION_NOT_ELIGIBLE = "PARTICIPATION_NOT_ELIGIBLE",
	EVENT_TIME_OUTSIDE_PARTICIPATION = "EVENT_TIME_OUTSIDE_PARTICIPATION",
	/** The event was detected against a Route geometry other than the Trip's authoritative one. */
	ROUTE_VERSION_MISMATCH = "ROUTE_VERSION_MISMATCH",
	/** The reported detection context does not satisfy the fixed V3 thresholds for its type. */
	THRESHOLD_NOT_MET = "THRESHOLD_NOT_MET",
	ID_CONFLICT = "ID_CONFLICT",
}
