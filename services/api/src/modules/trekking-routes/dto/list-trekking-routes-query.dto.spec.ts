import { validate } from "class-validator";
import { ListTrekkingRoutesQueryDto } from "./list-trekking-routes-query.dto";

describe("ListTrekkingRoutesQueryDto", () => {
	it("accepts a campsite UUID", async () => {
		const dto = Object.assign(new ListTrekkingRoutesQueryDto(), {
			campsiteId: "22222222-2222-4222-8222-222222222222",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("rejects a missing or malformed campsiteId", async () => {
		const missing = new ListTrekkingRoutesQueryDto();
		const malformed = Object.assign(new ListTrekkingRoutesQueryDto(), {
			campsiteId: "not-a-uuid",
		});

		expect(await validate(missing)).not.toHaveLength(0);
		expect(await validate(malformed)).not.toHaveLength(0);
	});
});
