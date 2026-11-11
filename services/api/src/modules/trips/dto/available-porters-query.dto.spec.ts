import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { AvailablePortersQueryDto, IntendedPorterRole } from "./available-porters-query.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});

describe("AvailablePortersQueryDto", () => {
	it("applies repository pagination defaults", async () => {
		await expect(
			pipe.transform({ role: "support" }, { type: "query", metatype: AvailablePortersQueryDto })
		).resolves.toEqual({
			role: IntendedPorterRole.SUPPORT,
			page: 1,
			limit: 20,
		});
	});

	it.each([
		{ role: "invalid" },
		{ role: "lead", minExperienceYears: -1 },
		{ role: "lead", minExperienceYears: 1.5 },
		{ role: "support", page: 0 },
		{ role: "support", limit: 101 },
	])("rejects invalid filters: %p", async (input) => {
		await expect(
			pipe.transform(input, { type: "query", metatype: AvailablePortersQueryDto })
		).rejects.toMatchObject({ status: 422 });
	});
});
