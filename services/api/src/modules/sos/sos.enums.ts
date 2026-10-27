/** SOS alert lifecycle states (CTMS-074, CTMS-077, CTMS-080). Kept in sync with `sos_status` DB enum. */
export enum SosStatus {
	ACTIVE = "active",
	ACKNOWLEDGED = "acknowledged",
	CANCELLED = "cancelled",
	CLOSED = "closed",
}

/** Emergency categories for SOS alerts (CTMS-074). Kept in sync with `emergency_type` DB enum. */
export enum EmergencyType {
	MEDICAL = "medical",
	INJURY = "injury",
	LOST = "lost",
	NATURAL_HAZARD = "natural_hazard",
	OTHER = "other",
}

/** Error codes for SOS operations. */
export enum SosErrorCode {
	SOS_NOT_FOUND = "SOS_NOT_FOUND",
	SOS_NOT_ACTIVE = "SOS_NOT_ACTIVE",
	SOS_ALREADY_CANCELLED = "SOS_ALREADY_CANCELLED",
	SOS_ALREADY_ACKNOWLEDGED = "SOS_ALREADY_ACKNOWLEDGED",
	SOS_ALREADY_CLOSED = "SOS_ALREADY_CLOSED",
	NOT_SOS_SENDER = "NOT_SOS_SENDER",
	TRIP_NOT_FOUND = "TRIP_NOT_FOUND",
	NOT_TRIP_PARTICIPANT = "NOT_TRIP_PARTICIPANT",
}
