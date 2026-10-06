import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { PorterAvailabilityStatus } from "../entities/porter-profile.entity";
import { normalizeStringArray } from "./normalized-string-array.validator";
import { UpdatePorterProfileDto } from "./update-porter-profile.dto";

const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	exceptionFactory: validationExceptionFactory,
});

function validate(payload: object): Promise<UpdatePorterProfileDto> {
	return pipe.transform(payload, {
		type: "body",
		metatype: UpdatePorterProfileDto,
		data: "",
	});
}

describe("UpdatePorterProfileDto", () => {
	it("accepts boundaries and empty arrays", async () => {
		await expect(
			validate({
				experienceYears: 0,
				certifications: [],
				languages: [],
				availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
			})
		).resolves.toBeInstanceOf(UpdatePorterProfileDto);
	});

	it.each([
		{ experienceYears: -1 },
		{ experienceYears: 1.5 },
		{ availabilityStatus: "busy" },
		{ certifications: Array.from({ length: 21 }, (_, index) => `certificate-${index}`) },
		{ certifications: [" "] },
		{ certifications: ["x".repeat(101)] },
		{ languages: [3] },
		{ languages: null },
		{ expectedVersion: null },
		{ ratingAvg: 5 },
		{ completedTrips: 4 },
		{ dayRate: 100 },
	])("rejects invalid or protected payload %#", async (payload) => {
		await expect(validate(payload)).rejects.toMatchObject({ status: 422 });
	});

	it("normalizes display spelling and case-insensitive duplicates", () => {
		expect(normalizeStringArray([" First Aid ", "first aid", "ENGLISH", " English "])).toEqual([
			"First Aid",
			"ENGLISH",
		]);
	});
});
