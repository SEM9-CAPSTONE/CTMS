import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsBoolean,
	IsEnum,
	IsISO8601,
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
import { INCIDENT_DESCRIPTION_MAX_LENGTH } from "../incidents.constants";
import { IncidentCategory, IncidentSeverity } from "../incidents.enums";

/** BR-188: absolute timestamps must carry an explicit timezone (Z or ±hh:mm). */
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;
const EXPLICIT_OFFSET_MESSAGE = "must include an explicit timezone offset";

export class IncidentLocationInputDto {
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

	@ApiProperty({
		example: "2026-10-12T08:29:40.000+07:00",
		description: "When the device obtained this fix; used to flag stale locations",
	})
	@IsISO8601({ strict: true })
	@Matches(EXPLICIT_OFFSET_PATTERN, { message: `capturedAt ${EXPLICIT_OFFSET_MESSAGE}` })
	capturedAt!: string;
}

export class ReportIncidentDto {
	@ApiProperty({
		format: "uuid",
		description: "Client-generated stable UUID; resending the same id never creates a duplicate",
	})
	@IsUUID()
	id!: string;

	@ApiProperty({ enum: IncidentCategory })
	@IsEnum(IncidentCategory)
	category!: IncidentCategory;

	@ApiProperty({ enum: IncidentSeverity })
	@IsEnum(IncidentSeverity)
	severity!: IncidentSeverity;

	@ApiProperty({ maxLength: INCIDENT_DESCRIPTION_MAX_LENGTH })
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(INCIDENT_DESCRIPTION_MAX_LENGTH)
	description!: string;

	@ApiProperty({
		example: "2026-10-12T08:30:00.000+07:00",
		description: "Original time the incident happened on the device, with explicit timezone",
	})
	@IsISO8601({ strict: true })
	@Matches(EXPLICIT_OFFSET_PATTERN, { message: `occurredAt ${EXPLICIT_OFFSET_MESSAGE}` })
	occurredAt!: string;

	@ApiPropertyOptional({
		type: IncidentLocationInputDto,
		nullable: true,
		description: "Omit or send null when no location fix is available; never send a guess",
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => IncidentLocationInputDto)
	location?: IncidentLocationInputDto | null;

	@ApiPropertyOptional({
		default: false,
		description: "True when the report was saved on the device while offline",
	})
	@IsOptional()
	@IsBoolean()
	capturedOffline?: boolean;
}
