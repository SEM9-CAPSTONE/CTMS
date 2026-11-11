import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsISO8601,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { GPS_LOG_BATCH_MAX_SIZE } from "../gps-tracking.constants";

/** BR-188: absolute timestamps must carry an explicit timezone (Z or ±hh:mm). */
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export class GpsLogInputDto {
	@ApiProperty({ format: "uuid", description: "Client-generated stable UUID (idempotency key)" })
	@IsUUID()
	id!: string;

	@ApiProperty({
		example: "2026-10-12T08:30:00.000+07:00",
		description: "Capture time of the original GPS sample, with explicit timezone",
	})
	@IsISO8601({ strict: true })
	@Matches(EXPLICIT_OFFSET_PATTERN, {
		message: "eventTime must include an explicit timezone offset",
	})
	eventTime!: string;

	@ApiProperty({ minimum: -90, maximum: 90 })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-90)
	@Max(90)
	latitude!: number;

	@ApiProperty({ minimum: -180, maximum: 180 })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-180)
	@Max(180)
	longitude!: number;

	@ApiProperty({ minimum: 0, description: "Horizontal accuracy in meters" })
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	accuracyMeters!: number;

	@ApiPropertyOptional({ description: "Altitude in meters, when the device provides it" })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	altitudeMeters?: number;

	@ApiPropertyOptional({
		minimum: 0,
		maximum: 100,
		description: "Battery percentage, when available",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	batteryLevel?: number;

	@ApiPropertyOptional({ maxLength: 64, description: "Offline Safety Package version in use" })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	packageVersion?: string;

	@ApiProperty({ maxLength: 32, description: "Tracking configuration version in use, e.g. v3" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(32)
	configVersion!: string;
}

export class CreateGpsLogsDto {
	@ApiProperty({ type: GpsLogInputDto, isArray: true, maxItems: GPS_LOG_BATCH_MAX_SIZE })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(GPS_LOG_BATCH_MAX_SIZE)
	@ValidateNested({ each: true })
	@Type(() => GpsLogInputDto)
	logs!: GpsLogInputDto[];
}
