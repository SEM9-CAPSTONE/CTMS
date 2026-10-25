import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsISO8601,
	IsIn,
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
	ValidateIf,
	ValidateNested,
} from "class-validator";
import {
	ROUTE_DEVIATION_CONFIG_VERSION,
	SAFETY_EVENT_BATCH_MAX_SIZE,
} from "../safety-events.constants";
import { SafetyEventType } from "../safety-events.enums";

/** BR-188: absolute timestamps must carry an explicit timezone (Z or ±hh:mm). */
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

/** Every type except GPS_DEGRADED is confirmed by a concrete VALID sample. */
const needsSample = (event: SafetyEventInputDto) =>
	event.eventType !== SafetyEventType.GPS_DEGRADED ||
	event.latitude !== undefined ||
	event.longitude !== undefined ||
	event.accuracyMeters !== undefined;

const needsRouteDistance = (event: SafetyEventInputDto) =>
	event.eventType === SafetyEventType.OFF_ROUTE ||
	event.eventType === SafetyEventType.ON_ROUTE_RECOVERED;

export class SafetyEventInputDto {
	@ApiProperty({ format: "uuid", description: "Client-generated stable UUID (idempotency key)" })
	@IsUUID()
	id!: string;

	@ApiProperty({ enum: SafetyEventType })
	@IsEnum(SafetyEventType)
	eventType!: SafetyEventType;

	@ApiProperty({
		example: "2026-10-26T08:30:00.000+07:00",
		description: "When the device confirmed the transition, with explicit timezone",
	})
	@IsISO8601({ strict: true })
	@Matches(EXPLICIT_OFFSET_PATTERN, {
		message: "eventTime must include an explicit timezone offset",
	})
	eventTime!: string;

	@ApiPropertyOptional({
		minimum: -90,
		maximum: 90,
		description: "Confirming sample; optional only for GPS_DEGRADED (last known fix)",
	})
	@ValidateIf(needsSample)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-90)
	@Max(90)
	latitude?: number;

	@ApiPropertyOptional({ minimum: -180, maximum: 180 })
	@ValidateIf(needsSample)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(-180)
	@Max(180)
	longitude?: number;

	@ApiPropertyOptional({ minimum: 0, description: "Horizontal accuracy of the sample in meters" })
	@ValidateIf(needsSample)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	accuracyMeters?: number;

	@ApiPropertyOptional({
		minimum: 0,
		description: "Device-computed distance to the Route; required for OFF_ROUTE/ON_ROUTE_RECOVERED",
	})
	@ValidateIf(needsRouteDistance)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	distanceToRouteMeters?: number;

	@ApiPropertyOptional({
		minimum: 1,
		description: "Consecutive VALID samples that confirmed OFF_ROUTE/ON_ROUTE_RECOVERED",
	})
	@ValidateIf(needsRouteDistance)
	@IsInt()
	@Min(1)
	@Max(1000)
	consecutiveValidSamples?: number;

	@ApiPropertyOptional({
		example: "2026-10-26T08:28:00.000+07:00",
		description: "GPS_DEGRADED only: last VALID sample time, or tracking start when there was none",
	})
	@ValidateIf((event: SafetyEventInputDto) => event.eventType === SafetyEventType.GPS_DEGRADED)
	@IsDefined()
	@IsISO8601({ strict: true })
	@Matches(EXPLICIT_OFFSET_PATTERN, {
		message: "noValidSampleSince must include an explicit timezone offset",
	})
	noValidSampleSince?: string;

	@ApiProperty({ description: "Whether the device had no Internet when it detected the event" })
	@IsBoolean()
	detectedOffline!: boolean;

	@ApiProperty({
		maxLength: 64,
		description: "routeVersion from the route-deviation context the device detected against",
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	routeVersion!: string;

	@ApiPropertyOptional({ maxLength: 64, description: "Offline Safety Package version in use" })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	packageVersion?: string;

	@ApiProperty({ example: ROUTE_DEVIATION_CONFIG_VERSION, enum: [ROUTE_DEVIATION_CONFIG_VERSION] })
	@IsIn([ROUTE_DEVIATION_CONFIG_VERSION])
	configVersion!: string;
}

export class CreateSafetyEventsDto {
	@ApiProperty({ type: SafetyEventInputDto, isArray: true, maxItems: SAFETY_EVENT_BATCH_MAX_SIZE })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(SAFETY_EVENT_BATCH_MAX_SIZE)
	@ValidateNested({ each: true })
	@Type(() => SafetyEventInputDto)
	events!: SafetyEventInputDto[];
}
