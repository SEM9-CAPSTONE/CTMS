import { UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { CancelSosDto } from "./cancel-sos.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});

const validate = (body: unknown) => pipe.transform(body, { type: "body", metatype: CancelSosDto });

describe("CancelSosDto (CTMS-077, BR-258)", () => {
	it("accepts a valid cancellation reason and trims whitespace", async () => {
		const result = (await validate({
			reason: "  Accidentally triggered while putting phone in pocket  ",
		})) as CancelSosDto;

		expect(result).toBeInstanceOf(CancelSosDto);
		expect(result.reason).toBe("Accidentally triggered while putting phone in pocket");
	});

	it("rejects an empty or whitespace-only reason", async () => {
		await expect(validate({ reason: "   " })).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects missing reason", async () => {
		await expect(validate({})).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects non-string reason", async () => {
		await expect(validate({ reason: 12345 })).rejects.toThrow(UnprocessableEntityException);
	});

	it("rejects reason longer than 500 characters", async () => {
		const longReason = "a".repeat(501);
		await expect(validate({ reason: longReason })).rejects.toThrow(UnprocessableEntityException);
	});
});
