import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PorterParticipationsQueryDto } from "./porter-participations-query.dto";
import { CreatePorterReviewDto } from "./porter-review.dto";

describe("CTMS-390 participation query and Unicode comment limits", () => {
	it("provides bounded defaults", async () => {
		const query = plainToInstance(PorterParticipationsQueryDto, {});
		expect(query).toMatchObject({ page: 1, limit: 10 });
		expect(await validate(query)).toHaveLength(0);
	});
	it.each([
		{ page: 0 },
		{ page: 10001 },
		{ page: 1.5 },
		{ limit: 0 },
		{ limit: 51 },
		{ limit: "invalid" },
		{ userId: "other" },
	])("rejects invalid query %p", async (input) => {
		expect(
			(
				await validate(plainToInstance(PorterParticipationsQueryDto, input), {
					whitelist: true,
					forbidNonWhitelisted: true,
				})
			).length
		).toBeGreaterThan(0);
	});
	it.each(["😊".repeat(2000), "☀️".repeat(1000), "á".repeat(2000), "a\u0301".repeat(1000)])(
		"accepts 2000 code points, including Vietnamese and emoji",
		async (comment) => {
			expect(
				await validate(
					plainToInstance(CreatePorterReviewDto, {
						porterId: "ef39b48f-ef47-4a1f-91b0-ad1826821adf",
						rating: 5,
						comment,
					})
				)
			).toHaveLength(0);
		}
	);
	it.each(["😊".repeat(2001), "☀️".repeat(1001), "á".repeat(2001), "a\u0301".repeat(1001)])(
		"rejects more than 2000 code points",
		async (comment) => {
			const errors = await validate(
				plainToInstance(CreatePorterReviewDto, {
					porterId: "ef39b48f-ef47-4a1f-91b0-ad1826821adf",
					rating: 5,
					comment,
				})
			);
			expect(errors).toContainEqual(expect.objectContaining({ property: "comment" }));
		}
	);
});
