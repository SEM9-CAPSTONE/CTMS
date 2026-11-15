import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ReportPeriodPreset } from "../../performance-reports/dto/get-performance-report-query.dto";

export enum RevenueGranularity {
	DAY = "day",
	WEEK = "week",
	MONTH = "month",
}

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() || undefined : value;
}

export class GetRevenueAnalyticsQueryDto {
	@ApiPropertyOptional({ description: "Start of reporting window (ISO 8601)" })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiPropertyOptional({ description: "End of reporting window (ISO 8601)" })
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiPropertyOptional({ enum: ReportPeriodPreset, default: ReportPeriodPreset.DAYS_30 })
	@IsOptional()
	@IsEnum(ReportPeriodPreset)
	period?: ReportPeriodPreset;

	@ApiPropertyOptional({
		enum: RevenueGranularity,
		default: RevenueGranularity.MONTH,
		description:
			"Time-series bucket. Coarsened automatically for long windows (day up to 92 days, week up to 730 days).",
	})
	@IsOptional()
	@IsEnum(RevenueGranularity)
	granularity?: RevenueGranularity;

	@ApiPropertyOptional({
		description: "Trip area snapshot code from GET /geo-areas (BR-319)",
		example: "DNG-SON-TRA",
	})
	@IsOptional()
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@MaxLength(32)
	areaCode?: string;

	@ApiPropertyOptional({
		format: "uuid",
		description: "Admin only: restrict to one Host. Ignored for Host callers (BR-318).",
	})
	@IsOptional()
	@IsUUID()
	hostId?: string;
}
