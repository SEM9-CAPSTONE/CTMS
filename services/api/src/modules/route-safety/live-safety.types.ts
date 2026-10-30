import type { SafetyCandidate } from "./route-safety.types";

export const SAFETY_PROVIDERS = ["NCHMF", "VNDMS", "OSM"] as const;
export type SafetyProvider = (typeof SAFETY_PROVIDERS)[number];
export interface LiveSafetySource {
	source: SafetyProvider;
	status: "LIVE" | "EMPTY" | "PARTIAL" | "UNAVAILABLE" | "DISABLED";
	checkedAt: string;
	dataTime: string | null;
	validUntil: string | null;
}
export interface LiveSafetySnapshot {
	source: LiveSafetySource;
	candidates: SafetyCandidate[];
}
