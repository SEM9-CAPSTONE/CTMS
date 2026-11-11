import type { ValidationArguments, ValidatorConstraintInterface } from "class-validator";
import { ValidatorConstraint } from "class-validator";

export function isCanonicalLineStringCoordinates(value: unknown): value is Array<[number, number]> {
	return (
		Array.isArray(value) &&
		value.length >= 2 &&
		value.every(
			(position) =>
				Array.isArray(position) &&
				position.length === 2 &&
				typeof position[0] === "number" &&
				Number.isFinite(position[0]) &&
				position[0] >= -180 &&
				position[0] <= 180 &&
				typeof position[1] === "number" &&
				Number.isFinite(position[1]) &&
				position[1] >= -90 &&
				position[1] <= 90
		)
	);
}

@ValidatorConstraint({ name: "canonicalLineStringCoordinates" })
export class CanonicalLineStringCoordinatesConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isCanonicalLineStringCoordinates(value);
	}

	defaultMessage(_args: ValidationArguments): string {
		return "coordinates must contain at least two finite [longitude, latitude] positions within valid ranges";
	}
}
