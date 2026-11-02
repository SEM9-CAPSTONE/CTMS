export type TerrainPosition = [number, number];
export type WalkingTerrain = "EASY" | "MODERATE" | "HARD" | "UNKNOWN";
export interface WalkingLeg {
	distanceMeters: number;
	terrain: WalkingTerrain;
}
export interface RouteDurationEstimate {
	/** TCVN 14602:2026, 14.3.5.2. Times are in minutes. */
	horizontalMinutes: number;
	verticalMinutes: number | null;
	estimatedMinutes: number;
	/** CTMS validation policy, not a minimum guaranteed by the standard. */
	minimumMinutes: number;
	estimateBasis: "TCVN" | "PARTIAL" | "DISTANCE_ONLY";
	classifiedDistanceMeters: number;
	unknownDistanceMeters: number;
}
export interface TerrainSample {
	coordinates: TerrainPosition;
	distanceMeters: number;
	elevationMeters: number;
	/** Signed slope from the preceding sample, in percent. */
	slopePercent: number;
}
export interface TerrainResult extends RouteDurationEstimate {
	status: "READY" | "UNAVAILABLE" | "NOT_CONFIGURED";
	source: "MapTiler";
	distanceMeters: number;
	sampleSpacingMeters: number;
	ascentMeters: number | null;
	descentMeters: number | null;
	maxSlopePercent: number | null;
	legs: WalkingLeg[];
	profile: TerrainSample[];
}
