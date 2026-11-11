import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export enum AuditLogOutcome {
	SUCCESS = "success",
	FAILURE = "failure",
}

export class ListAuditLogsQueryDto {
	@ApiPropertyOptional({ description: "Filter by actor user ID (UUID)" })
	@IsOptional()
	@IsUUID()
	actorId?: string;

	@ApiPropertyOptional({ description: "Filter by actor name, email or phone (partial match)" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	actor?: string;

	@ApiPropertyOptional({ description: "Filter by action name", maxLength: 80 })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	action?: string;

	@ApiPropertyOptional({ description: "Filter by target ID (UUID)" })
	@IsOptional()
	@IsUUID()
	targetId?: string;

	@ApiPropertyOptional({ description: "Filter by target ID (UUID) - alias for targetId" })
	@IsOptional()
	@IsUUID()
	target?: string;

	@ApiPropertyOptional({ description: "Filter by target type", maxLength: 80 })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	targetType?: string;

	@ApiPropertyOptional({ enum: AuditLogOutcome, description: "Filter by outcome" })
	@IsOptional()
	@IsEnum(AuditLogOutcome)
	outcome?: AuditLogOutcome;

	@ApiPropertyOptional({ description: "Filter by start time (ISO Date/time)" })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	startDate?: Date;

	@ApiPropertyOptional({ description: "Filter by end time (ISO Date/time)" })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	endDate?: Date;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}
