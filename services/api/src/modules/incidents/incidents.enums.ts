/** Incident categories a Porter can report (BR-161). Kept in sync with the `incident_category` DB enum. */
export enum IncidentCategory {
	INJURY = "injury",
	ILLNESS = "illness",
	LOST_MEMBER = "lost_member",
	EQUIPMENT_FAILURE = "equipment_failure",
	WEATHER_HAZARD = "weather_hazard",
	ROUTE_OBSTRUCTION = "route_obstruction",
	WILDLIFE = "wildlife",
	OTHER = "other",
}

export enum IncidentSeverity {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

/** Only the initial state belongs to CTMS-049; handling states are added by CTMS-086. */
export enum IncidentStatus {
	OPEN = "open",
}

/** How trustworthy the stored location is; decided by the server, never by the client. */
export enum IncidentLocationStatus {
	FRESH = "fresh",
	STALE = "stale",
	UNAVAILABLE = "unavailable",
}

/** Whether a report call stored a new incident or matched an already-synchronized one. */
export enum IncidentReportOutcome {
	CREATED = "created",
	DUPLICATE = "duplicate",
}

/** Machine-readable reasons a report is refused; clients treat these as final, not retryable. */
export enum IncidentErrorCode {
	TRIP_NOT_IN_PROGRESS = "INCIDENT_TRIP_NOT_IN_PROGRESS",
	OUTSIDE_TRIP_WINDOW = "INCIDENT_OUTSIDE_TRIP_WINDOW",
	ID_CONFLICT = "INCIDENT_ID_CONFLICT",
	MEDIA_INVALID = "INCIDENT_MEDIA_INVALID",
}
