import {
	GPS_LOGGING_INTERVAL_SECONDS,
	GPS_SAMPLING_INTERVAL_SECONDS,
} from "../gps-tracking/gps-tracking.constants";
import {
	GPS_DEGRADED_AFTER_SECONDS,
	OFF_ROUTE_MIN_DISTANCE_METERS,
	ON_ROUTE_MAX_DISTANCE_METERS,
	ROUTE_DEVIATION_CONFIG_VERSION,
	ROUTE_DEVIATION_CONSECUTIVE_SAMPLES,
	VALID_SAMPLE_MAX_ACCURACY_METERS,
} from "../safety-events/safety-events.constants";

/**
 * Version of the historical replay (grouping rule and evidence summary). A new value makes the
 * worker analyse every completed Trip again; episodes of different versions are never mixed.
 */
export const ROUTE_DEVIATION_ANALYSIS_VERSION = "v1-gps-log-replay";

/**
 * CTMS-115 AC2: the fixed V3 runtime context, reused as-is (spec §12: no new numeric threshold).
 * Stored on every episode so the result can be reproduced.
 */
export const ROUTE_DEVIATION_RUNTIME_CONTEXT = {
	configVersion: ROUTE_DEVIATION_CONFIG_VERSION,
	samplingIntervalSeconds: GPS_SAMPLING_INTERVAL_SECONDS,
	loggingIntervalSeconds: GPS_LOGGING_INTERVAL_SECONDS,
	validSampleMaxAccuracyMeters: VALID_SAMPLE_MAX_ACCURACY_METERS,
	offRouteMinDistanceMeters: OFF_ROUTE_MIN_DISTANCE_METERS,
	onRouteMaxDistanceMeters: ON_ROUTE_MAX_DISTANCE_METERS,
	consecutiveSamples: ROUTE_DEVIATION_CONSECUTIVE_SAMPLES,
	gpsDegradedAfterSeconds: GPS_DEGRADED_AFTER_SECONDS,
} as const;

/** Device-reported events this close to an episode are linked to it as cross-check evidence. */
export const DEVICE_EVENT_LINK_MARGIN_SECONDS = 120;

export const ROUTE_DEVIATION_EVENTS_DEFAULT_LIMIT = 50;
export const ROUTE_DEVIATION_EVENTS_MAX_LIMIT = 200;
