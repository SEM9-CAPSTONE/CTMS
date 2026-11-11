import type { ValidationArguments, ValidatorConstraintInterface } from "class-validator";
import { ValidatorConstraint } from "class-validator";

export function isCanonicalPointCoordinates(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		Number.isFinite(value[0]) &&
		value[0] >= -180 &&
		value[0] <= 180 &&
		typeof value[1] === "number" &&
		Number.isFinite(value[1]) &&
		value[1] >= -90 &&
		value[1] <= 90
	);
}

@ValidatorConstraint({ name: "canonicalPointCoordinates" })
export class CanonicalPointCoordinatesConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isCanonicalPointCoordinates(value);
	}

	defaultMessage(_args: ValidationArguments): string {
		return "coordinates must contain exactly one finite [longitude, latitude] position within valid ranges";
	}
}
