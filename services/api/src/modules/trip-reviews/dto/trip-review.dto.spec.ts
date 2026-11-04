import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTripReviewDto, UpdateTripReviewDto } from "./trip-review.dto";

const options = { whitelist: true, forbidNonWhitelisted: true };
describe("Trip review input (BR-301)", () => {
	it.each([1, 5])("accepts rating %d with optional comment", async (rating) => {
		expect(
			await validate(plainToInstance(CreateTripReviewDto, { target: "trip", rating }), options)
		).toHaveLength(0);
	});
	it.each([0, 6, 1.5, "5", null])("rejects invalid rating %p", async (rating) => {
		expect(
			(await validate(plainToInstance(CreateTripReviewDto, { target: "host", rating }), options))
				.length
		).toBeGreaterThan(0);
	});
	it.each([null, "", "   ", "a".repeat(2000)])(
		"accepts optional/maximum comment",
		async (comment) => {
			expect(
				await validate(
					plainToInstance(CreateTripReviewDto, { target: "trip", rating: 4, comment }),
					options
				)
			).toHaveLength(0);
		}
	);
	it.each([true, {}, 123, "a".repeat(2001)])("rejects invalid comment", async (comment) => {
		expect(
			(
				await validate(
					plainToInstance(CreateTripReviewDto, { target: "trip", rating: 4, comment }),
					options
				)
			).length
		).toBeGreaterThan(0);
	});
	it("normalizes outer whitespace and blank comments", () => {
		expect(plainToInstance(CreateTripReviewDto, { comment: "  trail\nfeedback  " }).comment).toBe(
			"trail\nfeedback"
		);
		expect(plainToInstance(CreateTripReviewDto, { comment: " \n " }).comment).toBeNull();
	});
	it.each(["reviewerId", "hostId", "tripId", "memberId", "targetId", "revision"])(
		"rejects client-supplied %s",
		async (field) => {
			expect(
				(
					await validate(
						plainToInstance(CreateTripReviewDto, { target: "trip", rating: 4, [field]: "forged" }),
						options
					)
				).length
			).toBeGreaterThan(0);
		}
	);
	it("rejects unknown targets and absent edit revision", async () => {
		expect(
			(
				await validate(
					plainToInstance(CreateTripReviewDto, { target: "porter", rating: 4 }),
					options
				)
			).length
		).toBeGreaterThan(0);
		expect(
			(await validate(plainToInstance(UpdateTripReviewDto, { rating: 4 }), options)).length
		).toBeGreaterThan(0);
	});
});
