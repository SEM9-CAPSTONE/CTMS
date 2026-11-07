import type { AspectType, IncidentType } from "./trip-review-moderation.types";

/**
 * Operational sample size thresholds per CTMS-387 Decision C and Spec Section 14.
 * Below threshold, hasSufficientSample = false and ranking/scoring metrics remain unactivated.
 */
export const DASHBOARD_TRIP_MIN_SAMPLE_SIZE = 5;
export const DASHBOARD_SAFETY_MIN_SAMPLE_SIZE = 10;

export const ALL_ASPECT_TYPES: readonly AspectType[] = [
	"safety",
	"guide_support",
	"equipment",
	"value",
] as const;

export const ALL_INCIDENT_TYPES: readonly IncidentType[] = [
	"fall_slip",
	"injury",
	"lost_path",
	"weather_hazard",
	"other",
] as const;
