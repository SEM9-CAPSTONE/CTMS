import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ReviewTrekkingRouteAction, ReviewTrekkingRouteDto } from "./review-trekking-route.dto";

async function validateDto(input: object) {
	return validate(plainToInstance(ReviewTrekkingRouteDto, input));
}

describe("ReviewTrekkingRouteDto", () => {
	it("accepts approval without a reason", async () => {
		await expect(validateDto({ action: ReviewTrekkingRouteAction.APPROVE })).resolves.toHaveLength(
			0
		);
	});

	it.each([ReviewTrekkingRouteAction.DECLINE, ReviewTrekkingRouteAction.NON_OPERABLE])(
		"requires a non-blank reason for %s",
		async (action) => {
			expect(await validateDto({ action })).not.toHaveLength(0);
			expect(await validateDto({ action, reason: "   " })).not.toHaveLength(0);
		}
	);

	it("trims a valid reason and accepts the 255-character boundary", async () => {
		const dto = plainToInstance(ReviewTrekkingRouteDto, {
			action: ReviewTrekkingRouteAction.DECLINE,
			reason: `  ${"x".repeat(255)}  `,
		});

		expect(await validate(dto)).toHaveLength(0);
		expect(dto.reason).toHaveLength(255);
	});

	it("rejects an overlong reason and arbitrary actions", async () => {
		expect(
			await validateDto({ action: ReviewTrekkingRouteAction.NON_OPERABLE, reason: "x".repeat(256) })
		).not.toHaveLength(0);
		expect(await validateDto({ action: "active" })).not.toHaveLength(0);
	});
});
