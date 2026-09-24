import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { ListContentReportsQueryDto } from "./list-content-reports-query.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (query: unknown) =>
	pipe.transform(query, { type: "query", metatype: ListContentReportsQueryDto });
describe("ListContentReportsQueryDto", () => {
	it("uses Admin pagination defaults and transforms numbers", async () => {
		await expect(validate({})).resolves.toEqual({ page: 1, limit: 20 });
		await expect(validate({ page: "2", limit: "100" })).resolves.toEqual({ page: 2, limit: 100 });
	});
	it.each([
		{ page: 0 },
		{ page: 1.5 },
		{ limit: 0 },
		{ limit: 101 },
		{ page: "bad" },
		{ status: "pending" },
		{ search: "text" },
	])("rejects invalid or unsupported query %p", async (query) => {
		await expect(validate(query)).rejects.toMatchObject({ status: 422 });
	});
});
