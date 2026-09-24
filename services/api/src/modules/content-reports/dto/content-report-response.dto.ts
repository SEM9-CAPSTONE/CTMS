import { ApiProperty } from "@nestjs/swagger";
import { ContentReportStatus } from "../content-report-status.enum";
import type { ContentReport } from "../entities/content-report.entity";

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

export class ContentReportsPaginationDto {
	@ApiProperty() page!: number;
	@ApiProperty() limit!: number;
	@ApiProperty() total!: number;
	@ApiProperty() totalPages!: number;
}

export class ContentReportQueueResponseDto {
	@ApiProperty({ type: [ContentReportResponseDto] })
	items!: ContentReportResponseDto[];
	@ApiProperty({ type: ContentReportsPaginationDto })
	pagination!: ContentReportsPaginationDto;
}

export function toContentReportResponse(
	report: ContentReport,
	reporter: ReportReporterDto
): ContentReportResponseDto {
	return {
		id: report.id,
		reporter: { id: reporter.id, fullName: reporter.fullName },
		targetType: report.targetType,
		targetId: report.targetId,
		reason: report.reason,
		status: report.status,
		createdAt: report.createdAt,
		updatedAt: report.updatedAt,
	};
}
