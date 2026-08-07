import { UnprocessableEntityException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

function formatErrors(errors: ValidationError[]): Array<{ field: string; errors: string[] }> {
	return errors.map((error) => ({
		field: error.property,
		errors: Object.values(error.constraints ?? {}),
	}));
}

/**
 * BR-231 requires 422 for invalid input, not Nest's default 400.
 */
export function validationExceptionFactory(
	errors: ValidationError[]
): UnprocessableEntityException {
	return new UnprocessableEntityException({
		statusCode: 422,
		error: "Unprocessable Entity",
		message: formatErrors(errors),
	});
}
