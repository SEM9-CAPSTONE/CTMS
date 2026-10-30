import type { SafetyCandidate, SafetyLifecycle, SafetySeverity } from "./route-safety.types";

export const SAFETY_FEATURE_LIMIT = 500;
export const SAFETY_IMPORT_LIMIT = 1000;
export const SAFETY_ROUTE_VERTEX_LIMIT = 10000;
export const SAFETY_DEFAULT_PROXIMITY_METERS = 300;
export const SAFETY_DEFAULT_CURRENT_AGE_MINUTES = 360;
export const SAFETY_DEFAULT_INCIDENT_AGE_MINUTES = 1440;
export const SEVERITY_ORDER: Record<SafetySeverity, number> = {
	UNKNOWN: 0,
	LOW: 1,
	MEDIUM: 2,
	HIGH: 3,
	VERY_HIGH: 4,
};

export function safetyLifecycle(
	candidate: SafetyCandidate,
	now: Date,
	maxAgeMinutes: number
): SafetyLifecycle {
	if (candidate.lifecycleStatus === "RESOLVED") return "RESOLVED";
	if (candidate.sourceType === "BASE_HISTORICAL") return "HISTORICAL";
	if (candidate.validFrom && Date.parse(candidate.validFrom) > now.getTime()) return "SCHEDULED";
	if (candidate.validUntil && Date.parse(candidate.validUntil) <= now.getTime()) return "EXPIRED";
	if (candidate.sourceType === "HOST_DEFINED") return "ACTIVE";
	if (candidate.validUntil) return "ACTIVE";
	const anchor = candidate.issuedAt ?? candidate.observedAt;
	if (!anchor || !Number.isFinite(Date.parse(anchor))) return "UNKNOWN";
	if (Date.parse(anchor) > now.getTime()) return "SCHEDULED";
	return now.getTime() - Date.parse(anchor) >= maxAgeMinutes * 60_000 ? "STALE" : "ACTIVE";
}

export function configuredNumber(
	value: string | undefined,
	fallback: number,
	min: number,
	max: number
): number {
	const parsed = Number(value);
	return value && Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
