import { describe, expect, it } from "vitest";
import { routeStatusActionSchema } from "./route-status-action.schema";

describe("routeStatusActionSchema", () => {
	it("trims and accepts a valid reason", () => {
		expect(routeStatusActionSchema.parse({ reason: "  Conditions are safe  " })).toEqual({
			reason: "Conditions are safe",
		});
	});

	it.each(["", "   "])("rejects blank reason %#", (reason) => {
		expect(routeStatusActionSchema.safeParse({ reason }).success).toBe(false);
	});

	it("accepts 255 characters and rejects more than 255", () => {
		expect(routeStatusActionSchema.safeParse({ reason: "a".repeat(255) }).success).toBe(true);
		expect(routeStatusActionSchema.safeParse({ reason: "a".repeat(256) }).success).toBe(false);
	});
});
