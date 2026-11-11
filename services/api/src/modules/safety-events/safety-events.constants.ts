/**
 * CTMS-060 fixed V3 route-deviation thresholds (spec §8). They must not be replaced
 * by configurable values unless the Product Backlog / Business Rules are revised.
 */
/** A GPS sample is VALID for detection only when its horizontal accuracy is at most this (BR-378). */
export const VALID_SAMPLE_MAX_ACCURACY_METERS = 20;
/** OFF_ROUTE needs a distance to the Route strictly greater than this (BR-375). */
export const OFF_ROUTE_MIN_DISTANCE_METERS = 50;
/** Recovery to ON_ROUTE needs a distance strictly lower than this (BR-382). */
export const ON_ROUTE_MAX_DISTANCE_METERS = 20;
/** Consecutive VALID samples needed to confirm OFF_ROUTE or the recovery (BR-377, BR-383). */
export const ROUTE_DEVIATION_CONSECUTIVE_SAMPLES = 3;
/** No VALID sample for at least this long while the Trip is ongoing means GPS_DEGRADED (BR-387). */
export const GPS_DEGRADED_AFTER_SECONDS = 120;
/** Identifies the fixed V3 detection configuration above, attached to every event. */
export const ROUTE_DEVIATION_CONFIG_VERSION = "v3";
/** Upper bound for one synchronization request; clients split larger buffers into several requests. */
export const SAFETY_EVENT_BATCH_MAX_SIZE = 100;
