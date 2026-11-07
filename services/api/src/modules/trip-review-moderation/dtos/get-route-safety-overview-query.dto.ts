import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class GetRouteSafetyOverviewQueryDto {
	@ApiPropertyOptional({
		description: "Optional route UUID filter to narrow safety signals to a specific trekking route",
	})
	@IsOptional()
	@IsUUID()
	routeId?: string;

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
