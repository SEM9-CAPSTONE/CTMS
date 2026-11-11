import type { RouteDurationEstimate, WalkingLeg, WalkingTerrain } from "./terrain.types";

export const WALKING_SPEED_KMH: Record<WalkingTerrain, number> = {
	EASY: 4,
	MODERATE: 3,
	HARD: 2,
	UNKNOWN: 4,
};
export const ROUTE_DURATION = {
	ascentMetersPerHour: 200,
	descentMetersPerHour: 300,
	smallerTimeWeight: 0.5,
	minutesPerHour: 60,
	metersPerKm: 1000,
	errorCode: "ROUTE_DURATION_TOO_SHORT",
	modelVersion: "tcvn-14602-v2",
} as const;

export function roundDurationMinutes(minutes: number): number {
	return Math.max(1, Math.ceil(Number(minutes.toFixed(9))));
}

export function estimateRouteDuration(
	legs: WalkingLeg[],
	ascentMeters: number | null,
	descentMeters: number | null,
	adequateElevationSampling = true
): RouteDurationEstimate {
	let horizontalMinutes = 0;
	let distanceMeters = 0;
	let unknownDistanceMeters = 0;
	for (const leg of legs) {
		if (!Number.isFinite(leg.distanceMeters) || leg.distanceMeters < 0) {
			throw new RangeError("Walking leg distance must be finite and nonnegative");
		}
		distanceMeters += leg.distanceMeters;
		if (leg.terrain === "UNKNOWN") unknownDistanceMeters += leg.distanceMeters;
		horizontalMinutes +=
			(leg.distanceMeters * ROUTE_DURATION.minutesPerHour) /
			(ROUTE_DURATION.metersPerKm * WALKING_SPEED_KMH[leg.terrain]);
	}
	const verticalAvailable = ascentMeters !== null && descentMeters !== null;
	if (
		verticalAvailable &&
		(!Number.isFinite(ascentMeters) ||
			!Number.isFinite(descentMeters) ||
			ascentMeters < 0 ||
			descentMeters < 0)
	) {
		throw new RangeError("Elevation gains and losses must be finite and nonnegative");
	}
	const verticalMinutes = verticalAvailable
		? (ascentMeters / ROUTE_DURATION.ascentMetersPerHour +
				descentMeters / ROUTE_DURATION.descentMetersPerHour) *
			ROUTE_DURATION.minutesPerHour
		: null;
	const referenceMinutes =
		verticalMinutes === null
			? horizontalMinutes
			: Math.max(horizontalMinutes, verticalMinutes) +
				ROUTE_DURATION.smallerTimeWeight * Math.min(horizontalMinutes, verticalMinutes);
	const estimatedMinutes = roundDurationMinutes(referenceMinutes);
	const complete = verticalAvailable && adequateElevationSampling && unknownDistanceMeters === 0;
	let estimateBasis: RouteDurationEstimate["estimateBasis"] = "PARTIAL";
	if (complete) estimateBasis = "TCVN";
	else if (!verticalAvailable) estimateBasis = "DISTANCE_ONLY";
	return {
		horizontalMinutes,
		verticalMinutes,
		estimatedMinutes,
		minimumMinutes: complete
			? estimatedMinutes
			: roundDurationMinutes(
					(distanceMeters * ROUTE_DURATION.minutesPerHour) /
						(ROUTE_DURATION.metersPerKm * WALKING_SPEED_KMH.UNKNOWN)
				),
		estimateBasis,
		classifiedDistanceMeters: distanceMeters - unknownDistanceMeters,
		unknownDistanceMeters,
	};
}
