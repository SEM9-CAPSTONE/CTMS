import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListTrekkingRoutesQueryDto } from "./list-trekking-routes-query.dto";

async function validateQuery(payload: Record<string, unknown>) {
	const dto = plainToInstance(ListTrekkingRoutesQueryDto, payload);
	return { dto, errors: await validate(dto) };
}

describe("ListTrekkingRoutesQueryDto", () => {
	it("uses the approved pagination defaults", async () => {
		const { dto, errors } = await validateQuery({});

		expect(errors).toEqual([]);
		expect(dto).toMatchObject({ page: 1, limit: 20, status: "all" });
	});

	it.each(["all", "draft", "pending_approval", "active", "closed"])(
		"accepts the supported status filter %s",
		async (status) => {
			const { dto, errors } = await validateQuery({ status });

			expect(errors).toEqual([]);
			expect(dto.status).toBe(status);
		}
	);

	it("rejects an unsupported status filter", async () => {
		const { errors } = await validateQuery({ status: "archived" });

		expect(errors.length).toBeGreaterThan(0);
	});

	it("transforms valid custom page and limit values", async () => {
		const { dto, errors } = await validateQuery({ page: "3", limit: "25" });

		expect(errors).toEqual([]);
		expect(dto).toMatchObject({ page: 3, limit: 25 });
	});

	it.each([
		{ page: "0", limit: "20" },
		{ page: "1.5", limit: "20" },
		{ page: "1", limit: "0" },
		{ page: "1", limit: "101" },
		{ page: "one", limit: "twenty" },
	])("rejects invalid pagination query %#", async (payload) => {
		const { errors } = await validateQuery(payload);

		expect(errors.length).toBeGreaterThan(0);
	});
});
