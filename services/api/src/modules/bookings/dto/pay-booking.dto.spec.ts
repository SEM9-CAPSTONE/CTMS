import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PayBookingDto } from "./pay-booking.dto";

describe("PayBookingDto", () => {
	it.each(["CARD", "BANK_TRANSFER", "WALLET"])(
		"accepts valid payment method %s",
		async (method) => {
			const dto = plainToInstance(PayBookingDto, {
				method,
			});
			await expect(validate(dto)).resolves.toHaveLength(0);
		}
	);

	it.each(["", "   "])("rejects empty payment method %p", async (method) => {
		const dto = plainToInstance(PayBookingDto, {
			method,
		});
		const errors = await validate(dto);
		expect(errors).not.toHaveLength(0);
	});

	it("rejects non-string payment method", async () => {
		const dto = plainToInstance(PayBookingDto, {
			method: 12345,
		});
		const errors = await validate(dto);
		expect(errors).not.toHaveLength(0);
	});

	it("rejects payment method exceeding 64 characters", async () => {
		const dto = plainToInstance(PayBookingDto, {
			method: "M".repeat(65),
		});
		const errors = await validate(dto);
		expect(errors).not.toHaveLength(0);
	});
});
