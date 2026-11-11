import type { SafetySeverity } from "./route-safety.types";
export type { LiveSafetySource, LiveSafetySnapshot } from "./live-safety.types";

export interface NchmfWarning {
	communeId: number;
	name: string;
	dataTime: string;
	issuedAt: string;
	validUntil: string;
	landslide: SafetySeverity | null;
	flashFlood: SafetySeverity | null;
}
