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
		["camper2@ctms.local", "camper2@ctms.local"],
		["host@ctms.local", "host@ctms.local"],
		["demo.camper@ctms.local", "demo.camper@ctms.local"],
		["user@example.com", "user@example.com"],
	])("accepts the project email contract for %s", async (email, expected) => {
		await expect(
			pipe.transform(
				{ email: `  ${email.toUpperCase()}  ` },
				{ type: "body", metatype: ResolveBookingMemberCandidateDto }
			)
		).resolves.toEqual({ email: expected });
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
