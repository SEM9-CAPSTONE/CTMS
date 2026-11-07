import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export enum ModerationQueueStatusFilter {
	PENDING_REVIEW = "pending_review",
	HIDDEN = "hidden",
	RESOLVED = "resolved",
}

export class GetHostModerationQueueQueryDto {
	@ApiPropertyOptional({
		enum: ModerationQueueStatusFilter,
		default: ModerationQueueStatusFilter.PENDING_REVIEW,
		description: "Filter by queue status: pending_review (with active flags), hidden, or resolved",
	})
	@IsOptional()
	@IsEnum(ModerationQueueStatusFilter)
	status: ModerationQueueStatusFilter = ModerationQueueStatusFilter.PENDING_REVIEW;

	@ApiPropertyOptional({
		description: "Optional trip UUID filter to narrow moderation items to a specific trip",
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
