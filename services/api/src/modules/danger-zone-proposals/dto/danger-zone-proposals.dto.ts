import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	Max,
	MaxLength,
	MinLength,
} from "class-validator";
import { RouteDangerZoneSeverity } from "../../trekking-routes/entities/route-danger-zone.entity";
import { DangerZoneProposalStatus } from "../danger-zone-proposals.enums";

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

/**
 * The Admin approves what will be shown publicly: severity, the public description and, for a
 * point, the recorded radius. The proposed position is kept as reported.
 */
export class ApproveDangerZoneProposalDto {
	@ApiProperty({ enum: RouteDangerZoneSeverity })
	@IsEnum(RouteDangerZoneSeverity)
	severity!: RouteDangerZoneSeverity;

	@ApiProperty({ maxLength: 1000 })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	description!: string;

	@ApiPropertyOptional({
		description: "Required for a point, forbidden for an area",
		maximum: 5000,
	})
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@IsPositive()
	@Max(5000)
	radiusMeters?: number;

	@ApiPropertyOptional({ maxLength: 1000 })
	@IsOptional()
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MaxLength(1000)
	reason?: string;
}

export class RejectDangerZoneProposalDto {
	@ApiProperty({ minLength: 10, maxLength: 1000 })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MinLength(10)
	@MaxLength(1000)
	reason!: string;
}

export class ListDangerZoneProposalsQueryDto {
	@ApiPropertyOptional({ enum: DangerZoneProposalStatus })
	@IsOptional()
	@IsEnum(DangerZoneProposalStatus)
	status?: DangerZoneProposalStatus;
}
