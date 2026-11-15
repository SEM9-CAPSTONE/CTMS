import { ApiProperty } from "@nestjs/swagger";
import { ContentReportStatus } from "./content-report-status.enum";

export enum ContentReportType {
	INACCURATE_INFORMATION = "inaccurate_information",
	DANGEROUS_CONTENT = "dangerous_content",
}

export enum ReportTargetType {
	TRIP_REVIEW = "trip_review",
}

export const REPORT_DESCRIPTION_MAX_LENGTH = 1000;
export const REPORT_IDEMPOTENCY_INDEX = "UQ_content_reports_reporter_key";
export const REPORT_OPEN_TARGET_INDEX = "UQ_content_reports_open_target";

export class SubmittedReport {
	@ApiProperty({ format: "uuid" })
	id!: string;
	@ApiProperty({ enum: ContentReportType })
	reportType!: ContentReportType;
	@ApiProperty({ enum: ReportTargetType })
	targetType!: ReportTargetType;
	@ApiProperty({ format: "uuid" })
	targetId!: string;
	@ApiProperty({ maxLength: REPORT_DESCRIPTION_MAX_LENGTH })
	description!: string;
	@ApiProperty({ enum: ContentReportStatus })
	status!: ContentReportStatus;
	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;
	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}

export interface StoredSubmission extends SubmittedReport {
	requestHash: string;
}
