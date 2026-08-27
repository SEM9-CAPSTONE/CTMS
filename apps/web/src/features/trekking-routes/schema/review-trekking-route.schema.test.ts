import { describe, expect, it } from "vitest";
import { reviewTrekkingRouteSchema } from "./review-trekking-route.schema";

describe("reviewTrekkingRouteSchema", () => {
	it("accepts approval without a reason", () => {
		expect(reviewTrekkingRouteSchema.parse({ action: "approve" })).toEqual({
			action: "approve",
			reason: "",
		});
	});

	it.each(["decline", "non_operable"] as const)("requires a nonblank reason for %s", (action) => {
		expect(reviewTrekkingRouteSchema.safeParse({ action, reason: "   " }).success).toBe(false);
	});

	it("trims a 255-character reason and rejects 256 characters", () => {
		const valid = reviewTrekkingRouteSchema.parse({
			action: "decline",
			reason: ` ${"x".repeat(255)} `,
		});
		expect(valid.reason).toHaveLength(255);
		expect(
			reviewTrekkingRouteSchema.safeParse({ action: "non_operable", reason: "x".repeat(256) })
				.success
		).toBe(false);
	});
});
