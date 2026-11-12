import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export enum ReportPeriodPreset {
	DAYS_7 = "7d",
	DAYS_30 = "30d",
	DAYS_90 = "90d",
	MONTHS_12 = "12m",
	THIS_MONTH = "this_month",
	LAST_MONTH = "last_month",
	ALL_TIME = "all",
}

export class GetPerformanceReportQueryDto {
	@ApiPropertyOptional({
		description: "Start of reporting window (ISO 8601)",
		example: "2026-10-01T00:00:00.000Z",
	})
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiPropertyOptional({
		description: "End of reporting window (ISO 8601)",
		example: "2026-10-31T23:59:59.999Z",
	})
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiPropertyOptional({
		description: "Quick reporting time window preset",
		enum: ReportPeriodPreset,
		example: ReportPeriodPreset.DAYS_30,
	})
	@IsOptional()
	@IsEnum(ReportPeriodPreset)
	period?: ReportPeriodPreset;

	@ApiPropertyOptional({
		description: "Filter trips by province snapshot keyword",
		example: "Lâm Đồng",
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	province?: string;

	@ApiPropertyOptional({
		description: "Filter trips by city snapshot keyword",
		example: "Đà Lạt",
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	city?: string;

	@ApiPropertyOptional({
		description: "Filter by specific Trekking Route UUID",
		example: "a0000000-0000-0000-0000-000000000001",
	})
	@IsOptional()
	@IsUUID()
	routeId?: string;

	@ApiPropertyOptional({
		description: "Filter by specific Trip UUID",
		example: "b0000000-0000-0000-0000-000000000001",
	})
	@IsOptional()
	@IsUUID()
	tripId?: string;
}
