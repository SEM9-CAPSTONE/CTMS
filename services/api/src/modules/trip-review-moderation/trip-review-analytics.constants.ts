import type { AspectType, IncidentType } from "./trip-review-moderation.types";

/**
 * Minimum number of eligible reviews required to activate dashboard scores & safety signals.
 * Any trip or route with at least 1 eligible review can be analyzed; 0 reviews stays unactivated.
 */
export const DASHBOARD_TRIP_MIN_SAMPLE_SIZE = 1;
export const DASHBOARD_SAFETY_MIN_SAMPLE_SIZE = 1;

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
