import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { InitializeBookingMembersDto } from "./initialize-booking-members.dto";

const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	exceptionFactory: validationExceptionFactory,
});

describe("InitializeBookingMembersDto", () => {
	it("accepts an empty additional-member list for a one-person Booking", async () => {
		await expect(
			pipe.transform({ members: [] }, { type: "body", metatype: InitializeBookingMembersDto })
		).resolves.toEqual(expect.objectContaining({ members: [] }));
	});

	it("accepts existing-user participant identifiers", async () => {
		const input = { members: [{ userId: "22222222-2222-4222-8222-222222222222" }] };
		await expect(
			pipe.transform(input, { type: "body", metatype: InitializeBookingMembersDto })
		).resolves.toEqual(expect.objectContaining(input));
	});

	it.each([
		{},
		{ members: "not-an-array" },
		{ members: [{}] },
		{ members: [{ userId: "not-a-uuid" }] },
		{ members: [{ userId: "22222222-2222-4222-8222-222222222222", name: "Guest" }] },
	])("rejects malformed roster input %#", async (input) => {
		await expect(
			pipe.transform(input, { type: "body", metatype: InitializeBookingMembersDto })
		).rejects.toMatchObject({ status: 422 });
	});
});
