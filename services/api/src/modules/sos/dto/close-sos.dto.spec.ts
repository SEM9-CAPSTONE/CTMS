import { UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { CloseSosDto } from "./close-sos.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});

const validate = (body: unknown) => pipe.transform(body, { type: "body", metatype: CloseSosDto });

describe("CloseSosDto (CTMS-080, BR-261)", () => {
	it("accepts a valid resolution note and trims whitespace", async () => {
		const result = (await validate({
			resolutionNote: "  Medical aid provided on site, camper is stable  ",
		})) as CloseSosDto;

		expect(result).toBeInstanceOf(CloseSosDto);
		expect(result.resolutionNote).toBe("Medical aid provided on site, camper is stable");
	});

	it("rejects an empty or whitespace-only resolution note", async () => {
		await expect(validate({ resolutionNote: "   " })).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects missing resolution note", async () => {
		await expect(validate({})).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects non-string resolution note", async () => {
		await expect(validate({ resolutionNote: 12345 })).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects resolution note longer than 500 characters", async () => {
		const longNote = "a".repeat(501);
		await expect(validate({ resolutionNote: longNote })).rejects.toThrow(
			UnprocessableEntityException
		);
	});
});
