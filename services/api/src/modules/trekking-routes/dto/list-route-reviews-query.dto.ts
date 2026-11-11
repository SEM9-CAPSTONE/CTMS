import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, Max, Min } from "class-validator";

export enum RouteReviewOutcome {
	PENDING = "pending",
	APPROVED = "approved",
	RETURNED_FOR_REVISION = "returned_for_revision",
	ALL = "all",
}

export class ListRouteReviewsQueryDto {
	@ApiPropertyOptional({ enum: RouteReviewOutcome, default: RouteReviewOutcome.PENDING })
	@IsEnum(RouteReviewOutcome)
	reviewOutcome: RouteReviewOutcome = RouteReviewOutcome.PENDING;

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
}
