import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { ResolveBookingMemberCandidateDto } from "./resolve-booking-member-candidate.dto";

const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	exceptionFactory: validationExceptionFactory,
});

describe("ResolveBookingMemberCandidateDto", () => {
	it("trims and lowercases a valid email", async () => {
		await expect(
			pipe.transform(
				{ email: "  Participant@Example.COM  " },
				{ type: "body", metatype: ResolveBookingMemberCandidateDto }
			)
		).resolves.toEqual({ email: "participant@example.com" });
	});

	it.each([
		{},
		{ email: "not-an-email" },
		{ email: `${"a".repeat(245)}@example.com` },
		{ email: "participant@example.com", fullName: "Private" },
	])("rejects invalid candidate input %#", async (input) => {
		await expect(
			pipe.transform(input, { type: "body", metatype: ResolveBookingMemberCandidateDto })
		).rejects.toMatchObject({ status: 422 });
	});
});
