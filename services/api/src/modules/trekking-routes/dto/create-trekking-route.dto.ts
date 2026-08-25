import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	Equals,
	IsArray,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
} from "class-validator";
import { TrekkingRouteDifficulty } from "../entities/trekking-route.entity";
import { CanonicalLineStringCoordinatesConstraint } from "../validators/line-string.validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class GeoJsonLineStringDto {
	@ApiProperty({ enum: ["LineString"] })
	@IsString()
	@Equals("LineString")
	type!: "LineString";

	@ApiProperty({
		type: "array",
		minItems: 2,
		items: {
			type: "array",
			minItems: 2,
			maxItems: 2,
			items: { type: "number" },
		},
		example: [
			[108.441, 11.941],
			[108.449, 11.946],
		],
	})
	@IsArray()
	@Validate(CanonicalLineStringCoordinatesConstraint)
	coordinates!: Array<[number, number]>;
}

export class CreateTrekkingRouteDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	campsiteId!: string;

	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	description?: string;

	@ApiProperty({ type: GeoJsonLineStringDto })
	@ValidateNested()
	@Type(() => GeoJsonLineStringDto)
	geometry!: GeoJsonLineStringDto;

	@ApiProperty({ enum: TrekkingRouteDifficulty })
	@IsEnum(TrekkingRouteDifficulty)
	difficulty!: TrekkingRouteDifficulty;

	@ApiProperty({ minimum: 1, example: 120 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	expectedDurationMinutes!: number;
}
