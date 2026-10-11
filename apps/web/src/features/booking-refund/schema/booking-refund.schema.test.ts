import { describe, expect, it } from "vitest";
import { refundRequestSchema } from "./booking-refund.schema";

describe("refundRequestSchema", () => {
	it("validates valid refund request data", () => {
		const valid = {
			reason: "Chuyến đi bị hoãn do thiên tai",
			amount: "500000.00",
			origin: "camper_complaint",
		};
		const parsed = refundRequestSchema.safeParse(valid);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.reason).toBe("Chuyến đi bị hoãn do thiên tai");
			expect(parsed.data.amount).toBe("500000.00");
		}
	});

	it("allows optional or empty amount", () => {
		const withoutAmount = {
			reason: "Không hài lòng về chất lượng dịch vụ",
			amount: "",
		};
		expect(refundRequestSchema.safeParse(withoutAmount).success).toBe(true);
	});

	it("rejects reason with less than 5 characters", () => {
		const shortReason = {
			reason: "Lỗi",
		};
		const parsed = refundRequestSchema.safeParse(shortReason);
		expect(parsed.success).toBe(false);
	});

	it("rejects reason exceeding 500 characters", () => {
		const longReason = {
			reason: "a".repeat(501),
		};
		const parsed = refundRequestSchema.safeParse(longReason);
		expect(parsed.success).toBe(false);
	});

	it("rejects invalid decimal amount format", () => {
		const invalidAmount = {
			reason: "Lý do hợp lệ",
			amount: "abc",
		};
		expect(refundRequestSchema.safeParse(invalidAmount).success).toBe(false);

		const threeDecimals = {
			reason: "Lý do hợp lệ",
			amount: "100.123",
		};
		expect(refundRequestSchema.safeParse(threeDecimals).success).toBe(false);
	});
});
