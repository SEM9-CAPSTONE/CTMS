import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class AdminSettlementQueryDto {
	@ApiPropertyOptional({
		description: "Filter by status: all | eligible | held | blocked | settled",
		default: "all",
	})
	@IsOptional()
	@IsString()
	status?: string;

	@ApiPropertyOptional({ description: "Search query for trip title or host name" })
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({ description: "Page number", default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ description: "Items per page", default: 15 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 15;
}
