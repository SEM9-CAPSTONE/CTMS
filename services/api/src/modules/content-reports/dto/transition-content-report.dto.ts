import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { ContentReportStatus } from "../content-report-status.enum";

export class TransitionContentReportDto {
	@ApiProperty({ enum: ContentReportStatus })
	@IsEnum(ContentReportStatus)
	expectedStatus!: ContentReportStatus;

	@ApiProperty({ enum: ContentReportStatus })
	@IsEnum(ContentReportStatus)
	status!: ContentReportStatus;
}
