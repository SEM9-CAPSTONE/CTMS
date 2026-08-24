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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function trimmedString(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	return value.trim();
}

function minutesSinceMidnight(value: string): number {
	const [hours, minutes] = value.split(":").map(Number);
	return hours * 60 + minutes;
}

function IsOperatingHoursOrder(validationOptions?: ValidationOptions) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: "isOperatingHoursOrder",
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(_value: unknown, args: ValidationArguments): boolean {
					const dto = args.object as CreateOperatingHoursDto;
					if (!TIME_PATTERN.test(dto.opensAt) || !TIME_PATTERN.test(dto.closesAt)) {
						return true;
					}
					return minutesSinceMidnight(dto.opensAt) < minutesSinceMidnight(dto.closesAt);
				},
			},
		});
	};
}

@ValidatorConstraint({ name: "mediaSortOrderSequence" })
export class MediaSortOrderSequenceConstraint implements ValidatorConstraintInterface {
	validate(media: CreateCampsiteMediaDto[] | undefined): boolean {
		if (!Array.isArray(media)) {
			return false;
		}
		const explicitOrders = media
			.map((item) => item.sortOrder)
			.filter((sortOrder): sortOrder is number => sortOrder !== undefined);
		return new Set(explicitOrders).size === explicitOrders.length;
	}

	defaultMessage(_args: ValidationArguments): string {
		return "media sortOrder values must be unique when provided";
	}
}

export class CreateOperatingHoursDto {
	@ApiProperty({ example: "08:00" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@Matches(TIME_PATTERN)
	opensAt!: string;

	@ApiProperty({ example: "18:00" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@Matches(TIME_PATTERN)
	@IsOperatingHoursOrder({ message: "operatingHours.closesAt must be after opensAt" })
	closesAt!: string;
}

export class CreateCampsitePoliciesDto {
	@ApiProperty({ maxLength: 2000 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	rules!: string;
}

export class CreateCampsiteMediaDto {
	@ApiProperty({ maxLength: 2000, example: "https://cdn.example.com/campsites/pine-1.jpg" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	@IsUrl({ require_protocol: true, protocols: ["http", "https"], require_tld: false })
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
	sortOrder?: number;
}

export class CreateCampsiteZoneDto {
	@ApiProperty({ maxLength: 150, example: "Bai ven suoi" })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiProperty({ minimum: -90, maximum: 90 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 6 })
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ minimum: -180, maximum: 180 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 6 })
	@Min(-180)
	@Max(180)
	longitude!: number;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxTents!: number;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxPeople!: number;

	@ApiProperty({ minimum: 0 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	basePrice!: number;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(30)
	@Transform(({ value }) =>
		Array.isArray(value)
			? value.map((item) => (typeof item === "string" ? item.trim() : item))
			: value
	)
	@IsString({ each: true })
	@MaxLength(80, { each: true })
	amenities?: string[];

	@ApiPropertyOptional({ maxLength: 2000 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@MaxLength(2000)
	terrainNote?: string;
}

export class CreateCampsiteDto {
	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiPropertyOptional({ maxLength: 2000 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@MaxLength(2000)
	description?: string;

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

	@ApiProperty({ type: CreateCampsitePoliciesDto })
	@ValidateNested()
	@Type(() => CreateCampsitePoliciesDto)
	policies!: CreateCampsitePoliciesDto;

	@ApiProperty({ type: CreateOperatingHoursDto })
	@ValidateNested()
	@Type(() => CreateOperatingHoursDto)
	operatingHours!: CreateOperatingHoursDto;

	@ApiPropertyOptional({ example: "2026-01-01" })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	seasonStartDate?: string;

	@ApiPropertyOptional({ example: "2026-12-31" })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	seasonEndDate?: string;

	@ApiPropertyOptional({ minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxAdvanceBookingDays?: number;

	@ApiPropertyOptional({ minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	minNights?: number;

	@ApiPropertyOptional({ minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxNights?: number;

	@ApiProperty({ type: [CreateCampsiteMediaDto], minItems: 1, maxItems: 10 })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@Validate(MediaSortOrderSequenceConstraint)
	@ValidateNested({ each: true })
	@Type(() => CreateCampsiteMediaDto)
	media!: CreateCampsiteMediaDto[];

	@ApiPropertyOptional({ type: [CreateCampsiteZoneDto], maxItems: 20 })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => CreateCampsiteZoneDto)
	zones?: CreateCampsiteZoneDto[];
}
