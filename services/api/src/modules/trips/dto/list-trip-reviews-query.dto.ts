import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, Max, Min } from "class-validator";

export enum TripReviewOutcome {
	PENDING = "pending",
	APPROVED = "approved",
	RETURNED_FOR_REVISION = "returned_for_revision",
	AUTO_REJECTED = "auto_rejected",
	ALL = "all",
}

export class ListTripReviewsQueryDto {
	@ApiPropertyOptional({ enum: TripReviewOutcome, default: TripReviewOutcome.PENDING })
	@IsEnum(TripReviewOutcome)
	reviewOutcome: TripReviewOutcome = TripReviewOutcome.PENDING;

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
