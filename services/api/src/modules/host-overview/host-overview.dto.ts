import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export const OVERVIEW_DEFAULT_LIMIT = 20;
export const OVERVIEW_MAX_LIMIT = 100;

export class HostOverviewQueryDto {
	@ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(1000000)
	page = 1;

	@ApiPropertyOptional({ default: OVERVIEW_DEFAULT_LIMIT, minimum: 1, maximum: OVERVIEW_MAX_LIMIT })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(OVERVIEW_MAX_LIMIT)
	limit = OVERVIEW_DEFAULT_LIMIT;
}
