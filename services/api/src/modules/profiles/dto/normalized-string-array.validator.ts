import {
	type ValidationArguments,
	type ValidationOptions,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
	registerDecorator,
} from "class-validator";

export const PORTER_LIST_MAX_ITEMS = 20;
export const PORTER_LIST_ITEM_MAX_LENGTH = 100;

@ValidatorConstraint({ name: "normalizedStringArray", async: false })
export class NormalizedStringArrayConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return (
			Array.isArray(value) &&
			value.length <= PORTER_LIST_MAX_ITEMS &&
			value.every((item) => {
				if (typeof item !== "string") return false;
				const normalized = item.trim();
				return normalized.length > 0 && normalized.length <= PORTER_LIST_ITEM_MAX_LENGTH;
			})
		);
	}

	defaultMessage(arguments_: ValidationArguments): string {
		return `${arguments_.property} must contain at most ${PORTER_LIST_MAX_ITEMS} non-empty strings of at most ${PORTER_LIST_ITEM_MAX_LENGTH} characters after trimming`;
	}
}

export function IsNormalizedStringArray(validationOptions?: ValidationOptions): PropertyDecorator {
	return (target: object, propertyName: string | symbol): void => {
		registerDecorator({
			target: target.constructor,
			propertyName: String(propertyName),
			options: validationOptions,
			validator: NormalizedStringArrayConstraint,
		});
	};
}

export function normalizeStringArray(values: string[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		const key = trimmed.toLocaleLowerCase("en-US");
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(trimmed);
	}
	return normalized;
}
