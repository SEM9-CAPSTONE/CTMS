/** Maximum incident description length, matching the `trip_incidents.description` column. */
export const INCIDENT_DESCRIPTION_MAX_LENGTH = 2000;
/** Tolerated device clock drift when checking that an event time is not in the future. */
export const INCIDENT_CLOCK_SKEW_SECONDS = 5 * 60;
/** A fix captured further than this from the event time is flagged as stale (BR-221). */
export const INCIDENT_LOCATION_STALE_AFTER_SECONDS = 5 * 60;
/** BR-224: optional incident photo limits. */
export const INCIDENT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
/** Sub-folder of the upload root that holds incident photos. */
export const INCIDENT_MEDIA_DIRECTORY = "incidents";
