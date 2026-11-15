import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import {
	ContentReportType,
	REPORT_DESCRIPTION_MAX_LENGTH,
	ReportTargetType,
} from "../report-submission.types";

export class CreateContentReportDto {
	@ApiProperty({ format: "uuid", description: "Stable client key reused for retries" })
	@IsUUID("4")
	idempotencyKey!: string;

	@ApiProperty({ enum: ContentReportType })
	@IsEnum(ContentReportType)
	reportType!: ContentReportType;

	@ApiProperty({ enum: ReportTargetType })
	@IsEnum(ReportTargetType)
	targetType!: ReportTargetType;

	@ApiProperty({ format: "uuid" })
	@IsUUID()
	targetId!: string;

	@ApiProperty({ maxLength: REPORT_DESCRIPTION_MAX_LENGTH })
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(REPORT_DESCRIPTION_MAX_LENGTH)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: PostgreSQL text cannot store NUL.
	@Matches(/^[^\u0000]*$/u)
	description!: string;
}
