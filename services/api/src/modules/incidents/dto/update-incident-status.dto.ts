import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { IncidentStatus } from "../incidents.enums";

export class UpdateIncidentStatusDto {
	@ApiProperty({
		enum: IncidentStatus,
		description: "New status for the incident following valid lifecycle transitions",
	})
	@IsEnum(IncidentStatus, { message: "status must be a valid IncidentStatus" })
	status!: IncidentStatus;

	@ApiPropertyOptional({
		description: "Optional action note explaining the status change",
		maxLength: 2000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}
