/** Version of the clustering procedure; part of every candidate and of its uniqueness key. */
export const SAFETY_HOTSPOT_ANALYSIS_VERSION = "v1-anchor-cluster";
export const SAFETY_HOTSPOT_CONFIG_VERSION = "v3";

/** BR-417 fixed V3 criteria (spec §12: no extra threshold is introduced). */
export const SAFETY_HOTSPOT_CRITERIA = {
	windowDays: 30,
	clusterRadiusMeters: 50,
	minDistinctTrips: 3,
	minDistinctMembers: 3,
	minEvents: 5,
} as const;

export const SAFETY_HOTSPOT_LIST_DEFAULT_LIMIT = 50;
export const SAFETY_HOTSPOT_LIST_MAX_LIMIT = 200;
