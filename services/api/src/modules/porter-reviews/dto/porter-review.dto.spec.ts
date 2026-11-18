import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePorterReviewDto, UpdatePorterReviewDto } from "./porter-review.dto";

const porterId = "5dd1683e-f693-4bc1-a938-a0b9c9db6902";
const options = { whitelist: true, forbidNonWhitelisted: true };
const create = (body: object) =>
	validate(plainToInstance(CreatePorterReviewDto, { porterId, ...body }), options);

describe("Porter review input", () => {
	it.each([1, 2, 3, 4, 5])("accepts rating %d", async (rating) => {
		expect(await create({ rating })).toHaveLength(0);
	});
	it.each([0, 6, 1.5, "5", null, undefined])("rejects invalid rating %p", async (rating) => {
		expect((await create({ rating })).length).toBeGreaterThan(0);
	});
	it.each([null, "", "   ", "a".repeat(2000)])(
		"accepts optional or maximum comment",
		async (comment) => {
			expect(await create({ rating: 4, comment })).toHaveLength(0);
		}
	);
	it.each([true, {}, 123, "a".repeat(2001)])("rejects invalid comment", async (comment) => {
		expect((await create({ rating: 4, comment })).length).toBeGreaterThan(0);
	});
	it("only trims surrounding whitespace without rewriting source content", () => {
		expect(
			plainToInstance(CreatePorterReviewDto, { comment: "  <b>Hỗ trợ tốt</b>\nCảm ơn  " }).comment
		).toBe("<b>Hỗ trợ tốt</b>\nCảm ơn");
		expect(plainToInstance(CreatePorterReviewDto, { comment: " \n " }).comment).toBeNull();
	});
	it.each(["reviewerId", "tripId", "memberId", "bookingId", "moderationStatus", "editExpiresAt"])(
		"rejects forged %s",
		async (field) => {
			expect((await create({ rating: 4, [field]: "forged" })).length).toBeGreaterThan(0);
		}
	);
	it("requires a valid Porter account ID", async () => {
		expect((await create({ porterId: "assignment-row", rating: 4 })).length).toBeGreaterThan(0);
	});
	it.each([undefined, 0, 1.5, "1"])(
		"requires an integer expected revision: %p",
		async (expectedRevision) => {
			expect(
				(
					await validate(
						plainToInstance(UpdatePorterReviewDto, { rating: 4, expectedRevision }),
						options
					)
				).length
			).toBeGreaterThan(0);
		}
	);
});
