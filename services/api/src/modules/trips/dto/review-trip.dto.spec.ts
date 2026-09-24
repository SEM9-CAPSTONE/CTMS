import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ReviewTripAction, ReviewTripDto } from "./review-trip.dto";

async function validateDto(input: object) {
	return validate(plainToInstance(ReviewTripDto, input));
}

describe("ReviewTripDto", () => {
	it("accepts approval without a reason", async () => {
		await expect(validateDto({ action: ReviewTripAction.APPROVE })).resolves.toHaveLength(0);
	});

	it("requires a non-blank reason for decline", async () => {
		expect(await validateDto({ action: ReviewTripAction.DECLINE })).not.toHaveLength(0);
		expect(await validateDto({ action: ReviewTripAction.DECLINE, reason: "   " })).not.toHaveLength(
			0
		);
	});

	it("trims a valid reason and accepts the 255-character boundary", async () => {
		const dto = plainToInstance(ReviewTripDto, {
			action: ReviewTripAction.DECLINE,
			reason: `  ${"x".repeat(255)}  `,
		});

		expect(await validate(dto)).toHaveLength(0);
		expect(dto.reason).toHaveLength(255);
	});

	it("rejects an overlong reason and arbitrary actions", async () => {
		expect(
			await validateDto({ action: ReviewTripAction.DECLINE, reason: "x".repeat(256) })
		).not.toHaveLength(0);
		expect(await validateDto({ action: "publish" })).not.toHaveLength(0);
	});
});
