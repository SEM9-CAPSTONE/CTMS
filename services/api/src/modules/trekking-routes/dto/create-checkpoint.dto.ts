import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	Equals,
	IsArray,
	IsBoolean,
	IsDefined,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsString,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
} from "class-validator";
import { CHECKPOINT_RADIUS_METERS } from "../constants";
import { CheckpointType } from "../entities/checkpoint.entity";
import { CanonicalPointCoordinatesConstraint } from "../validators/point.validator";

/** Start/finish/rest belong to trip waypoints; route checkpoints only mark on-route locations. */
export const ROUTE_CHECKPOINT_TYPES = [
	CheckpointType.WATER,
	CheckpointType.DANGEROUS,
	CheckpointType.EMERGENCY_SHELTER,
] as const;

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

	@ApiProperty({ enum: [CHECKPOINT_RADIUS_METERS], default: CHECKPOINT_RADIUS_METERS })
	@Type(() => Number)
	@IsInt()
	@Equals(CHECKPOINT_RADIUS_METERS)
	radiusMeters: number = CHECKPOINT_RADIUS_METERS;

	@ApiProperty({ enum: ROUTE_CHECKPOINT_TYPES })
	@IsIn(ROUTE_CHECKPOINT_TYPES)
	type!: CheckpointType;

	@ApiProperty({ minimum: 0, example: 45 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	expectedArrivalOffset!: number;

	@ApiProperty({ maxLength: 1000, required: false, default: "" })
	@Transform(({ value }) => (value == null ? "" : trimmedString(value)))
	@IsString()
	@MaxLength(1000)
	instructions = "";

	@ApiProperty()
	@IsBoolean()
	nearbyWaterOrShelter!: boolean;
}
