import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListRouteReviewsQueryDto, RouteReviewOutcome } from "./list-route-reviews-query.dto";

describe("ListRouteReviewsQueryDto", () => {
	it("defaults to pending review page 1", async () => {
		const dto = plainToInstance(ListRouteReviewsQueryDto, {});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto).toEqual({ reviewOutcome: RouteReviewOutcome.PENDING, page: 1, limit: 20 });
	});

	it.each(Object.values(RouteReviewOutcome))("accepts outcome %s", async (reviewOutcome) => {
		const dto = plainToInstance(ListRouteReviewsQueryDto, {
			reviewOutcome,
			page: "2",
			limit: "10",
		});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.page).toBe(2);
	});

	it.each([{ reviewOutcome: "rejected" }, { page: 0 }, { limit: 101 }])(
		"rejects invalid query %#",
		async (input) => {
			expect(await validate(plainToInstance(ListRouteReviewsQueryDto, input))).not.toHaveLength(0);
		}
	);
});
