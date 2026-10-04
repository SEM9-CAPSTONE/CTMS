import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CancelBookingDto } from "./cancel-booking.dto";

describe("CancelBookingDto", () => {
	it("accepts omission and trims optional reasons", async () => {
		const dto = plainToInstance(CancelBookingDto, { reason: "  changed plans  " });
		expect(dto.reason).toBe("changed plans");
		expect(await validate(dto)).toHaveLength(0);
		expect(await validate(plainToInstance(CancelBookingDto, {}))).toHaveLength(0);
	});
	it.each([null, 12, {}, "x".repeat(256)])("rejects invalid reason %p", async (reason) => {
		expect(await validate(plainToInstance(CancelBookingDto, { reason }))).not.toHaveLength(0);
	});
	it.each(["actor", "cancelledAt", "refundPercent", "refundAmount", "status", "paymentStatus"])(
		"rejects server-owned %s",
		async (field) => {
			expect(
				await validate(plainToInstance(CancelBookingDto, { [field]: "forged" }), {
					whitelist: true,
					forbidNonWhitelisted: true,
				})
			).not.toHaveLength(0);
		}
	);
});
