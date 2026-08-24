import { UnprocessableEntityException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

function formatErrors(
	errors: ValidationError[],
	parentPath = ""
): Array<{ field: string; errors: string[] }> {
	return errors.flatMap((error) => {
		const field = parentPath ? `${parentPath}.${error.property}` : error.property;
		const constraints = Object.values(error.constraints ?? {});
		const childErrors = formatErrors(error.children ?? [], field);

		if (constraints.length === 0) {
			return childErrors;
		}

		return [{ field, errors: constraints }, ...childErrors];
	});
}

export function validationExceptionFactory(
	errors: ValidationError[]
): UnprocessableEntityException {
	return new UnprocessableEntityException({
		statusCode: 422,
		error: "Unprocessable Entity",
		message: formatErrors(errors),
	});
}
