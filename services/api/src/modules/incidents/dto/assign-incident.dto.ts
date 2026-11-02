import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class AssignIncidentDto {
	@ApiPropertyOptional({
		description: "User ID to assign the incident to, or null to remove assignment",
		format: "uuid",
		nullable: true,
	})
	@IsOptional()
	@IsUUID("4", { message: "assignedTo must be a valid UUID" })
	assignedTo?: string | null;

	@ApiPropertyOptional({
		description: "Optional action note explaining the assignment",
		maxLength: 2000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}
