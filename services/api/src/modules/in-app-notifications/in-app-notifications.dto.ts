import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListInAppNotificationsDto {
	@ApiPropertyOptional({ default: 20, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(250)
	cursor?: string;

	@ApiPropertyOptional({ enum: ["read", "unread"] })
	@IsOptional()
	@IsIn(["read", "unread"])
	state?: "read" | "unread";
}
