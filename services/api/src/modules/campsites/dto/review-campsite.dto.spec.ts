import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ReviewCampsiteAction, ReviewCampsiteDto } from "./review-campsite.dto";

describe("ReviewCampsiteDto", () => {
	it("accepts a valid approve payload without a reason", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.APPROVE,
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});

	it("accepts a valid approve payload with a reason (ignores validation for reason on approve)", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.APPROVE,
			reason: "Looks great!",
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});

	it("accepts a valid decline payload with a reason", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.DECLINE,
			reason: "Missing contact info.",
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});

	it("rejects a decline payload without a reason", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.DECLINE,
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("reason");
	});

	it("rejects a decline payload with an empty or whitespace-only reason", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.DECLINE,
			reason: "   ",
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("reason");
	});

	it("rejects an invalid action", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: "reject",
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("action");
	});

	it("rejects a reason that exceeds 500 characters", async () => {
		const dto = plainToInstance(ReviewCampsiteDto, {
			action: ReviewCampsiteAction.DECLINE,
			reason: "a".repeat(501),
		});

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe("reason");
	});
});
