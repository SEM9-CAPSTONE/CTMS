import { validate } from "class-validator";
import { RefundOrigin } from "../refund-policy";
import { ProcessRefundDto } from "./process-refund.dto";

describe("ProcessRefundDto (CTMS-035)", () => {
	it("validates successfully with empty optional fields", async () => {
		const dto = new ProcessRefundDto();
		const errors = await validate(dto);
		expect(errors).toHaveLength(0);
	});

	it("validates successfully with valid obligationId and origin", async () => {
		const dto = new ProcessRefundDto();
		dto.obligationId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
		dto.origin = RefundOrigin.CAMPER_CANCELLATION;
		dto.amount = "50.00";
		dto.reason = "Approved camper cancellation";

		const errors = await validate(dto);
		expect(errors).toHaveLength(0);
	});

	it("fails validation with invalid UUID for obligationId", async () => {
		const dto = new ProcessRefundDto();
		dto.obligationId = "not-a-uuid";

		const errors = await validate(dto);
		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("obligationId");
	});

	it("fails validation with negative or invalid amount string", async () => {
		const dto = new ProcessRefundDto();
		dto.amount = "-50.00";

		const errors = await validate(dto);
		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("amount");
	});

	it("fails validation with invalid origin enum", async () => {
		const dto = new ProcessRefundDto();
		dto.origin = "invalid_origin" as RefundOrigin;

		const errors = await validate(dto);
		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("origin");
	});

	it("fails validation when reason exceeds 255 characters", async () => {
		const dto = new ProcessRefundDto();
		dto.reason = "a".repeat(256);

		const errors = await validate(dto);
		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("reason");
	});
});
