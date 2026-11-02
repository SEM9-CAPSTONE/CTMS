import type { Position } from "../trekking-routes/types";

export interface TerrainResult {
	status: "READY" | "UNAVAILABLE" | "NOT_CONFIGURED";
	source: "MapTiler";
	distanceMeters: number;
	sampleSpacingMeters: number;
	ascentMeters: number | null;
	descentMeters: number | null;
	maxSlopePercent: number | null;
	estimatedMinutes: number;
	minimumMinutes: number;
	horizontalMinutes: number;
	verticalMinutes: number | null;
	estimateBasis: "TCVN" | "PARTIAL" | "DISTANCE_ONLY";
	classifiedDistanceMeters: number;
	unknownDistanceMeters: number;
	legs: { distanceMeters: number; terrain: "EASY" | "MODERATE" | "HARD" | "UNKNOWN" }[];
	profile: {
		coordinates: Position;
		distanceMeters: number;
		elevationMeters: number;
		slopePercent: number;
	}[];
}
