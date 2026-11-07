import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class GetTripFeedbackOverviewQueryDto {
	@ApiPropertyOptional({
		description: "Optional trip UUID filter to narrow feedback overview to a specific trip",
	})
	@IsOptional()
	@IsUUID()
	tripId?: string;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	limit = 10;
}
