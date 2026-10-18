import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, Max, Min } from "class-validator";
import { TrekkingRouteStatus } from "../entities/trekking-route.entity";

export const ALL_TREKKING_ROUTE_STATUSES = "all" as const;
export type TrekkingRouteStatusFilter = typeof ALL_TREKKING_ROUTE_STATUSES | TrekkingRouteStatus;

export class ListTrekkingRoutesQueryDto {
	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;

	@ApiPropertyOptional({
		default: ALL_TREKKING_ROUTE_STATUSES,
		enum: [ALL_TREKKING_ROUTE_STATUSES, ...Object.values(TrekkingRouteStatus)],
	})
	@IsIn([ALL_TREKKING_ROUTE_STATUSES, ...Object.values(TrekkingRouteStatus)])
	status: TrekkingRouteStatusFilter = ALL_TREKKING_ROUTE_STATUSES;
}
