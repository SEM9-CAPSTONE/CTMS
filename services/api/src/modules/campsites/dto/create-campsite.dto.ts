import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	Matches,
	Max,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
	type ValidationArguments,
	type ValidationOptions,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
	registerDecorator,
} from "class-validator";

const OPERATING_HOURS_PATTERN = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function trimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	return value.trim();
}

function IsOperatingHoursRange(validationOptions?: ValidationOptions) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: "isOperatingHoursRange",
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					if (typeof value !== "string" || !OPERATING_HOURS_PATTERN.test(value)) {
						return false;
					}
					const [opensAt, closesAt] = value.split("-");
					return minutesSinceMidnight(opensAt) < minutesSinceMidnight(closesAt);
				},
			},
		});
	};
}

function minutesSinceMidnight(value: string): number {
	const [hours, minutes] = value.split(":").map(Number);
	return hours * 60 + minutes;
}

@ValidatorConstraint({ name: "imageDisplayOrderSequence" })
class ImageDisplayOrderSequenceConstraint implements ValidatorConstraintInterface {
	validate(images: CreateCampsiteImageDto[] | undefined): boolean {
		if (!Array.isArray(images)) {
			return false;
		}
		const explicitOrders = images
			.map((image) => image.displayOrder)
			.filter((displayOrder): displayOrder is number => displayOrder !== undefined);
		return new Set(explicitOrders).size === explicitOrders.length;
	}

	defaultMessage(_args: ValidationArguments): string {
		return "initialImages displayOrder values must be unique when provided";
	}
}

export class CreateCampsiteImageDto {
	@ApiProperty({ maxLength: 2000, example: "https://cdn.example.com/campsites/pine-1.jpg" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	@IsUrl({ require_protocol: true, protocols: ["http", "https"] })
	url!: string;

	@ApiPropertyOptional({ enum: ["photo"], default: "photo" })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsIn(["photo"])
	type?: "photo";

	@ApiPropertyOptional({ minimum: 0, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	displayOrder?: number;
}

export class CreateCampsiteDto {
	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiProperty({ maxLength: 2000 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	description!: string;

	@ApiProperty({ minimum: -90, maximum: 90, example: 11.940419 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 6 })
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ minimum: -180, maximum: 180, example: 108.458313 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 6 })
	@Min(-180)
	@Max(180)
	longitude!: number;

	@ApiProperty({ maxLength: 100 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	province!: string;

	@ApiProperty({ maxLength: 100 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	city!: string;

	@ApiProperty({ maxLength: 2000 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	policies!: string;

	@ApiProperty({ example: "08:00-18:00", description: "Daily operating hours in HH:mm-HH:mm" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@Matches(OPERATING_HOURS_PATTERN)
	@IsOperatingHoursRange({ message: "operatingHours must have a start time earlier than end time" })
	@MaxLength(200)
	operatingHours!: string;

	@ApiProperty({ type: [CreateCampsiteImageDto], minItems: 1, maxItems: 10 })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@Validate(ImageDisplayOrderSequenceConstraint)
	@ValidateNested({ each: true })
	@Type(() => CreateCampsiteImageDto)
	initialImages!: CreateCampsiteImageDto[];
}
