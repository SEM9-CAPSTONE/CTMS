import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	Equals,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsString,
	Max,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
} from "class-validator";
import { CheckpointType } from "../entities/checkpoint.entity";
import { CanonicalPointCoordinatesConstraint } from "../validators/point.validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class GeoJsonPointDto {
	@ApiProperty({ enum: ["Point"] })
	@IsString()
	@Equals("Point")
	type!: "Point";

	@ApiProperty({ type: "array", minItems: 2, maxItems: 2, items: { type: "number" } })
	@IsArray()
	@Validate(CanonicalPointCoordinatesConstraint)
	coordinates!: [number, number];
}

export class CreateCheckpointDto {
	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiProperty({ type: GeoJsonPointDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => GeoJsonPointDto)
	location!: GeoJsonPointDto;

	@ApiProperty({ minimum: 10, maximum: 500, example: 30 })
	@Type(() => Number)
	@IsInt()
	@Min(10)
	@Max(500)
	radiusMeters!: number;

	@ApiProperty({ enum: CheckpointType })
	@IsEnum(CheckpointType)
	type!: CheckpointType;

	@ApiProperty({ minimum: 0, example: 45 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	expectedArrivalOffset!: number;

	@ApiProperty({ maxLength: 1000 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	instructions!: string;

	@ApiProperty()
	@IsBoolean()
	nearbyWaterOrShelter!: boolean;
}
