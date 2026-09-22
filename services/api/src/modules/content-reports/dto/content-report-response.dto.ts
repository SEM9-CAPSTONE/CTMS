import { ApiProperty } from "@nestjs/swagger";
import { ContentReportStatus } from "../content-report-status.enum";

export class ReportReporterDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ type: String, nullable: true })
	fullName!: string | null;
}

export class ContentReportResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ type: ReportReporterDto })
	reporter!: ReportReporterDto;

	@ApiProperty({ maxLength: 100 })
	targetType!: string;

	@ApiProperty({ format: "uuid" })
	targetId!: string;

	@ApiProperty({ maxLength: 1000 })
	reason!: string;

	@ApiProperty({ enum: ContentReportStatus })
	status!: ContentReportStatus;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}
