import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { PorterRouteProficiency } from "../entities/porter-route-qualification.entity";
import { UpsertPorterRouteQualificationDto } from "./upsert-porter-route-qualification.dto";
import { VerifyPorterRouteQualificationDto } from "./verify-porter-route-qualification.dto";

const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	exceptionFactory: validationExceptionFactory,
});

function validate<T extends object>(payload: object, metatype: new () => T): Promise<T> {
	return pipe.transform(payload, { type: "body", metatype, data: "" });
}

describe("Porter qualification DTOs", () => {
	it.each(Object.values(PorterRouteProficiency))("accepts proficiency %s", async (proficiency) => {
		await expect(
			validate({ proficiency, timesLed: 0 }, UpsertPorterRouteQualificationDto)
		).resolves.toBeInstanceOf(UpsertPorterRouteQualificationDto);
	});

	it.each([
		{ proficiency: "master", timesLed: 0 },
		{ proficiency: PorterRouteProficiency.LEARNING, timesLed: -1 },
		{ proficiency: PorterRouteProficiency.LEARNING, timesLed: 1.5 },
		{ proficiency: PorterRouteProficiency.LEARNING, timesLed: 0, porterId: "spoof" },
		{ proficiency: PorterRouteProficiency.LEARNING, timesLed: 0, verifiedBy: "spoof" },
	])("rejects invalid claim %#", async (payload) => {
		await expect(validate(payload, UpsertPorterRouteQualificationDto)).rejects.toMatchObject({
			status: 422,
		});
	});

	it("allows only expectedVersion in verification", async () => {
		await expect(
			validate({ expectedVersion: 1 }, VerifyPorterRouteQualificationDto)
		).resolves.toBeInstanceOf(VerifyPorterRouteQualificationDto);
		await expect(
			validate({ expectedVersion: 1, proficiency: "expert" }, VerifyPorterRouteQualificationDto)
		).rejects.toMatchObject({ status: 422 });
	});
});
