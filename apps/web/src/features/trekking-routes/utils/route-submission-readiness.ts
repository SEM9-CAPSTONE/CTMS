import type { RouteCheckpoint } from "../types";

export type RouteSubmissionReadinessIssue =
	| "missing_start"
	| "missing_finish"
	| "duplicate_start"
	| "duplicate_finish"
	| "invalid_order";

export interface RouteSubmissionReadiness {
	canSubmit: boolean;
	issues: RouteSubmissionReadinessIssue[];
}

type SubmissionCheckpoint = Pick<RouteCheckpoint, "routePosition" | "type">;

export function getRouteSubmissionReadiness(
	checkpoints: readonly SubmissionCheckpoint[]
): RouteSubmissionReadiness {
	const starts = checkpoints.filter((checkpoint) => checkpoint.type === "start");
	const finishes = checkpoints.filter((checkpoint) => checkpoint.type === "finish");
	const issues: RouteSubmissionReadinessIssue[] = [];

	if (starts.length === 0) issues.push("missing_start");
	if (starts.length > 1) issues.push("duplicate_start");
	if (finishes.length === 0) issues.push("missing_finish");
	if (finishes.length > 1) issues.push("duplicate_finish");
	if (
		starts.length === 1 &&
		finishes.length === 1 &&
		starts[0].routePosition >= finishes[0].routePosition
	) {
		issues.push("invalid_order");
	}

	return { canSubmit: issues.length === 0, issues };
}
