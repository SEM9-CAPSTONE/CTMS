export enum RealtimeEvaluationStatus {
	PASSED = "PASSED",
	FAILED = "FAILED",
}

export enum RealtimeEvaluationGateName {
	SOS_DELIVERY_P95 = "SOS_DELIVERY_P95",
	NORMAL_EVENT_P95 = "NORMAL_EVENT_P95",
	NORMAL_EVENT_P99 = "NORMAL_EVENT_P99",
	MISSED_EVENT_RECOVERY = "MISSED_EVENT_RECOVERY",
}

export enum RealtimeEvaluationScenario {
	/** SOS events to one client on a stable connection, one at a time (AC2). */
	STABLE_SOS = "STABLE_SOS",
	/** A burst of normal events to many connected clients at once (AC3, AC5 concurrency). */
	CONCURRENT_NORMAL = "CONCURRENT_NORMAL",
	/** Events published while a client is offline, recovered with `realtime.resume` (AC4). */
	RECONNECT_RECOVERY = "RECONNECT_RECOVERY",
	/** After reconnecting, the user and role rooms are joined again and live events arrive (AC5). */
	ROOM_RESTORE = "ROOM_RESTORE",
	/** Live and recovered copies carry the same event id, so a client handles each event once (AC5). */
	DUPLICATE_HANDLING = "DUPLICATE_HANDLING",
}
