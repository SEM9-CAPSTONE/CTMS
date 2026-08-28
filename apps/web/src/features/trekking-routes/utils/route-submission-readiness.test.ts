import { describe, expect, it } from "vitest";
import { getRouteSubmissionReadiness } from "./route-submission-readiness";

const checkpoint = (
	type: "start" | "rest" | "water" | "dangerous" | "emergency_shelter" | "finish",
	routePosition: number
) => ({
	type,
	routePosition,
});

describe("getRouteSubmissionReadiness", () => {
	it("accepts exactly one ordered start and finish while keeping other types optional", () => {
		expect(
			getRouteSubmissionReadiness([checkpoint("start", 0.1), checkpoint("finish", 0.9)])
		).toEqual({ canSubmit: true, issues: [] });
		expect(
			getRouteSubmissionReadiness([
				checkpoint("start", 0.1),
				checkpoint("rest", 0.3),
				checkpoint("water", 0.4),
				checkpoint("dangerous", 0.5),
				checkpoint("emergency_shelter", 0.6),
				checkpoint("finish", 0.9),
			])
		).toEqual({ canSubmit: true, issues: [] });
	});

	it.each([
		{ checkpoints: [checkpoint("finish", 0.9)], issue: "missing_start" },
		{ checkpoints: [checkpoint("start", 0.1)], issue: "missing_finish" },
		{
			checkpoints: [checkpoint("start", 0.1), checkpoint("start", 0.2), checkpoint("finish", 0.9)],
			issue: "duplicate_start",
		},
		{
			checkpoints: [checkpoint("start", 0.1), checkpoint("finish", 0.8), checkpoint("finish", 0.9)],
			issue: "duplicate_finish",
		},
	])("rejects $issue", ({ checkpoints, issue }) => {
		const readiness = getRouteSubmissionReadiness(checkpoints);
		expect(readiness.canSubmit).toBe(false);
		expect(readiness.issues).toContain(issue);
	});

	it.each([0.5, 0.9])("rejects a start at or after the finish position", (startPosition) => {
		expect(
			getRouteSubmissionReadiness([checkpoint("start", startPosition), checkpoint("finish", 0.5)])
		).toEqual({ canSubmit: false, issues: ["invalid_order"] });
	});
});
