import type { FitnessLevel } from "../profiles/entities/health-profile.entity";
import type { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";

export type FitnessFit = "good" | "stretch" | "too_hard";
const DIFFICULTY_LEVEL: Readonly<Record<string, number>> = {
	easy: 0,
	moderate: 1,
	hard: 2,
	expert: 3,
};
const FITNESS_CEILING: Readonly<Record<string, number>> = {
	BEGINNER: 0,
	INTERMEDIATE: 1,
	ADVANCED: 2,
	EXPERT: 3,
};
export const LONG_ROUTE_METERS = 15_000;
export const LONG_ROUTE_MINUTES = 8 * 60;
export function isLongRoute(length: number | null, minutes: number | null): boolean {
	return (
		(length !== null && length > LONG_ROUTE_METERS) ||
		(minutes !== null && minutes > LONG_ROUTE_MINUTES)
	);
}
export function fitnessFit(
	level: FitnessLevel,
	difficulty: TrekkingRouteDifficulty | null,
	length: number | null,
	minutes: number | null
): FitnessFit | null {
	if (difficulty === null) return null;
	const over =
		(DIFFICULTY_LEVEL[difficulty] ?? 0) +
		(isLongRoute(length, minutes) ? 1 : 0) -
		(FITNESS_CEILING[level] ?? 0);
	return over <= 0 ? "good" : over === 1 ? "stretch" : "too_hard";
}
