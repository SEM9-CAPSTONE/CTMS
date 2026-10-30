import type { SafetyCollection } from "./types";

export const SAFETY_DEBOUNCE_MS = 500;
export const SAFETY_REFRESH_MS = 60_000;
export const SAFETY_STALE_MS = 0;
export const SAFETY_SOURCE_ID = "ctms-route-safety";
export const SAFETY_PROVIDERS = ["NCHMF", "VNDMS", "OSM"] as const;
export const SAFETY_FEATURE_LIMIT = 500;
export const SEVERITY_ORDER = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 } as const;
export const EMPTY_SAFETY_COLLECTION: SafetyCollection = {
	type: "FeatureCollection",
	features: [],
};
