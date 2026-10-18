import { describe, expect, it } from "vitest";
import { reviewTrekkingRouteSchema } from "./review-trekking-route.schema";

describe("reviewTrekkingRouteSchema", () => {
	it("accepts approval without a reason", () => {
		expect(reviewTrekkingRouteSchema.parse({ action: "approve" })).toEqual({
			action: "approve",
			reason: "",
		});
	});

	it("requires a nonblank reason for decline", () => {
		expect(reviewTrekkingRouteSchema.safeParse({ action: "decline", reason: "   " }).success).toBe(
			false
		);
	});

	it("trims a 255-character reason and rejects 256 characters", () => {
		const valid = reviewTrekkingRouteSchema.parse({
			action: "decline",
			reason: ` ${"x".repeat(255)} `,
		});
		expect(valid.reason).toHaveLength(255);
		expect(
			reviewTrekkingRouteSchema.safeParse({ action: "decline", reason: "x".repeat(256) }).success
		).toBe(false);
	});

	it("rejects operational closure as an approval decision", () => {
		expect(
			reviewTrekkingRouteSchema.safeParse({ action: "non_operable", reason: "Unsafe" }).success
		).toBe(false);
	});
});
