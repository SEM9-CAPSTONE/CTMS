import { describe, expect, it } from "vitest";
import { payBookingSchema } from "./pay-booking.schema";

describe("payBookingSchema", () => {
	it("accepts valid payment methods", () => {
		expect(payBookingSchema.safeParse({ method: "CARD" }).success).toBe(true);
		expect(payBookingSchema.safeParse({ method: "BANK_TRANSFER" }).success).toBe(true);
		expect(payBookingSchema.safeParse({ method: "WALLET" }).success).toBe(true);
	});

	it("trims whitespace from method", () => {
		const result = payBookingSchema.safeParse({ method: "  CARD  " });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.method).toBe("CARD");
		}
	});

	it("rejects missing method", () => {
		const result = payBookingSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects empty or whitespace-only method", () => {
		expect(payBookingSchema.safeParse({ method: "" }).success).toBe(false);
		expect(payBookingSchema.safeParse({ method: "   " }).success).toBe(false);
	});

	it("rejects method exceeding 64 characters", () => {
		const longMethod = "A".repeat(65);
		const result = payBookingSchema.safeParse({ method: longMethod });
		expect(result.success).toBe(false);
	});
});
