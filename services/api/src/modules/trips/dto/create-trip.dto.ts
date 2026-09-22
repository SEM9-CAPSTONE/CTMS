import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMinSize,
	Equals,
	IsArray,
	IsEnum,
	IsISO8601,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
} from "class-validator";
import { CanonicalPointCoordinatesConstraint } from "../../trekking-routes/validators/point.validator";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { TripType } from "../entities/trip.entity";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class GeoJsonPointDto {
	@ApiProperty({ enum: ["Point"] })
	@IsString()
	@Equals("Point")
	type!: "Point";

	@ApiProperty({
		type: "array",
		minItems: 2,
		maxItems: 2,
		items: { type: "number" },
		example: [108.441, 11.941],
	})
	@IsArray()
	@Validate(CanonicalPointCoordinatesConstraint)
	coordinates!: [number, number];
}

export class CreateTripWaypointDto {
	@ApiPropertyOptional({ format: "uuid" })
	@IsOptional()
	@IsUUID()
	checkpointId?: string;

	@ApiProperty({ enum: WaypointType })
	@IsEnum(WaypointType)
	type!: WaypointType;

	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	name!: string;

	@ApiProperty({ type: GeoJsonPointDto })
	@ValidateNested()
	@Type(() => GeoJsonPointDto)
	location!: GeoJsonPointDto;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	dayNumber!: number;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	sequenceOrder!: number;

	@ApiPropertyOptional({ format: "date-time" })
	@IsOptional()
	@IsISO8601({ strict: true })
	plannedAt?: string;

	@ApiPropertyOptional({ minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	durationMinutes?: number;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, unknown>;
}

export class CreateTripDto {
	@ApiProperty({ format: "uuid" })
	@IsUUID()
	routeId!: string;

	@ApiProperty({ maxLength: 150 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(150)
	title!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	description?: string;

	@ApiPropertyOptional({ maxLength: 500 })
	@IsOptional()
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@MaxLength(500)
	coverImageUrl?: string;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	itinerary?: Record<string, unknown>;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	includes?: Record<string, unknown>;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	excludes?: Record<string, unknown>;

	@ApiProperty({ enum: TripType })
	@IsEnum(TripType)
	tripType!: TripType;

	@ApiProperty({ format: "date-time" })
	@IsISO8601({ strict: true })
	startsAt!: string;

	@ApiProperty({ format: "date-time" })
	@IsISO8601({ strict: true })
	endsAt!: string;

	@ApiProperty({ type: GeoJsonPointDto })
	@ValidateNested()
	@Type(() => GeoJsonPointDto)
	meetingPoint!: GeoJsonPointDto;

	@ApiPropertyOptional({ format: "date-time" })
	@IsOptional()
	@IsISO8601({ strict: true })
	meetingAt?: string;

	@ApiProperty({ format: "date-time" })
	@IsISO8601({ strict: true })
	bookingDeadline!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	capacityMin!: number;

	@ApiPropertyOptional({ minimum: 1, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	capacityMax?: number | null;

	@ApiProperty({ minimum: 0 })
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	pricePerPerson!: number;

	@ApiPropertyOptional({ type: "object", additionalProperties: true })
	@IsOptional()
	@IsObject()
	cancellationPolicy?: Record<string, unknown>;

	@ApiProperty({ type: CreateTripWaypointDto, isArray: true, minItems: 1 })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateTripWaypointDto)
	waypoints!: CreateTripWaypointDto[];
}

export class ConfigureTripWaypointsDto {
	@ApiProperty({ type: CreateTripWaypointDto, isArray: true, minItems: 1 })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateTripWaypointDto)
	waypoints!: CreateTripWaypointDto[];
}
