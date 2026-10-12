/** BR-368: runtime GPS sampling is fixed at one sample every 10 seconds in V3 (not configurable). */
export const GPS_SAMPLING_INTERVAL_SECONDS = 10;
/** BR-396: one gps_log is persisted every 30 seconds in V3 (not configurable). */
export const GPS_LOGGING_INTERVAL_SECONDS = 30;
/** Identifies the fixed V3 tracking configuration above, attached to every log as version context. */
export const GPS_TRACKING_CONFIG_VERSION = "v3";
/** Upper bound for one synchronization request; clients split larger buffers into several requests. */
export const GPS_LOG_BATCH_MAX_SIZE = 100;
