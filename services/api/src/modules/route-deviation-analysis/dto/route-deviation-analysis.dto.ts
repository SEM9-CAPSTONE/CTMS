import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ROUTE_DEVIATION_EVENTS_MAX_LIMIT } from "../route-deviation-analysis.constants";

export class ListRouteDeviationEventsQueryDto {
	@ApiPropertyOptional({ description: "Only episodes of this Trip" })
	@IsOptional()
	@IsUUID()
	tripId?: string;

	@ApiPropertyOptional({ description: "Only episodes on this Route" })
	@IsOptional()
	@IsUUID()
	routeId?: string;

	@ApiPropertyOptional({
		description: "true: only episodes with full package/session context (BR-363)",
		type: Boolean,
	})
	@IsOptional()
	@Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
	@IsBoolean()
	authoritative?: boolean;

	@ApiPropertyOptional({ example: 50, maximum: ROUTE_DEVIATION_EVENTS_MAX_LIMIT })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(ROUTE_DEVIATION_EVENTS_MAX_LIMIT)
	limit?: number;
}
