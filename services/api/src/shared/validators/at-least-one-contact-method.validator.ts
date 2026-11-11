import {
	type ValidationArguments,
	type ValidationOptions,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
	registerDecorator,
} from "class-validator";

@ValidatorConstraint({ name: "AtLeastOneContactMethod", async: false })
class AtLeastOneContactMethodConstraint implements ValidatorConstraintInterface {
	validate(_value: unknown, args: ValidationArguments): boolean {
		const object = args.object as { email?: string; phone?: string };
		return Boolean(object.email) || Boolean(object.phone);
	}

	defaultMessage(): string {
		return "Either email or phone must be provided";
	}
}

/**
 * class-validator's @IsOptional()/@ValidateIf() skip ALL decorators on the
 * property they're attached to, including custom ones. Since email and phone
 * are both individually optional, this check must be anchored on a property
 * that is never conditionally skipped (password) so it always runs.
 */
export function AtLeastOneContactMethod(validationOptions?: ValidationOptions) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: AtLeastOneContactMethodConstraint,
		});
	};
}
