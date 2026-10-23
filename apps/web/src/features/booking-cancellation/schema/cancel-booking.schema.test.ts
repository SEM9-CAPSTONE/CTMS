import { expect, it } from "vitest";
import { cancelBookingSchema } from "./cancel-booking.schema";

it("requires a reason, trims and accepts 255 characters", () => {
	expect(cancelBookingSchema.safeParse({}).success).toBe(false);
	expect(cancelBookingSchema.safeParse({ reason: "   " }).success).toBe(false);
	expect(cancelBookingSchema.parse({ reason: " reason " })).toEqual({ reason: "reason" });
	expect(cancelBookingSchema.safeParse({ reason: "x".repeat(255) }).success).toBe(true);
});
it.each([{ reason: "x".repeat(256) }, { reason: null }, { reason: 1 }, { refundAmount: "1" }])(
	"rejects invalid input %j",
	(input) => {
		expect(cancelBookingSchema.safeParse(input).success).toBe(false);
	}
);
