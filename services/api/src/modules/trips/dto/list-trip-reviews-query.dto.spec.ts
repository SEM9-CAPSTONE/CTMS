import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListTripReviewsQueryDto, TripReviewOutcome } from "./list-trip-reviews-query.dto";

describe("ListTripReviewsQueryDto", () => {
	it("defaults to pending review page 1", async () => {
		const dto = plainToInstance(ListTripReviewsQueryDto, {});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto).toEqual({ reviewOutcome: TripReviewOutcome.PENDING, page: 1, limit: 20 });
	});

	it.each(Object.values(TripReviewOutcome))("accepts outcome %s", async (reviewOutcome) => {
		const dto = plainToInstance(ListTripReviewsQueryDto, { reviewOutcome, page: "2", limit: "10" });
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.limit).toBe(10);
	});

	it.each([{ reviewOutcome: "declined" }, { page: 0 }, { limit: 101 }])(
		"rejects invalid query %#",
		async (input) => {
			expect(await validate(plainToInstance(ListTripReviewsQueryDto, input))).not.toHaveLength(0);
		}
	);
});
