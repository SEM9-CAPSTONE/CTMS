export const CHECKPOINT_ARRIVAL_DISTANCE_METERS = 20;
export const CHECKPOINT_ARRIVAL_SAMPLE_COUNT = 3;
export const CHECKPOINT_ARRIVAL_BATCH_SIZE = 100;

/** Trusted, immutable checkpoint slice supplied by the active package publisher. */
export interface CheckpointArrivalContext {
	tripId: string;
	routeId: string;
	routeVersion: string;
	packageId: string;
	packageVersion: string;
	checkpoints: Array<{ id: string; latitude: number; longitude: number }>;
	contextSource?: "authoritative" | "fallback" | "demo";
}

export enum CheckpointArrivalSyncStatus {
	ACCEPTED = "accepted",
	DUPLICATE = "duplicate",
	REJECTED = "rejected",
}

export enum CheckpointArrivalRejection {
	CONTEXT_MISMATCH = "context_mismatch",
	CHECKPOINT_NOT_IN_PACKAGE = "checkpoint_not_in_package",
	THRESHOLD_NOT_MET = "threshold_not_met",
	INVALID_SAMPLE_SEQUENCE = "invalid_sample_sequence",
	ID_CONFLICT = "id_conflict",
	EVENT_TIME_IN_FUTURE = "event_time_in_future",
	TRIP_COMPLETED_WINDOW_EXPIRED = "trip_completed_window_expired",
	TRIP_NOT_TRACKABLE = "trip_not_trackable",
	PARTICIPATION_NOT_ELIGIBLE = "participation_not_eligible",
	EVENT_TIME_OUTSIDE_PARTICIPATION = "event_time_outside_participation",
	PROCESSING_ERROR = "processing_error",
}

export interface CheckpointArrivalResult {
	id: string;
	clientId: string;
	status: CheckpointArrivalSyncStatus;
	reason: CheckpointArrivalRejection | null;
	retryable: boolean;
	visitId: string | null;
	receivedAt: Date | null;
}
