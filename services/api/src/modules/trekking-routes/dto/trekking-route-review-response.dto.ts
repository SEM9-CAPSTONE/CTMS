import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CheckpointResponseDto } from "./checkpoint-response.dto";
import { RouteReviewOutcome } from "./list-route-reviews-query.dto";
import { RouteDangerZoneResponseDto } from "./route-danger-zone-response.dto";
import {
	TrekkingRouteResponseDto,
	TrekkingRoutesPaginationDto,
} from "./trekking-route-response.dto";

export class TrekkingRouteReviewResponseDto extends TrekkingRouteResponseDto {
	@ApiPropertyOptional({ enum: RouteReviewOutcome })
	reviewOutcome?: Exclude<RouteReviewOutcome, RouteReviewOutcome.ALL>;

	@ApiPropertyOptional({ nullable: true })
	reviewedAt?: Date | null;

	@ApiProperty({ type: CheckpointResponseDto, isArray: true })
	checkpoints!: CheckpointResponseDto[];

	@ApiProperty({ type: RouteDangerZoneResponseDto, isArray: true })
	dangerZones!: RouteDangerZoneResponseDto[];
}

export class PaginatedRouteReviewsResponseDto {
	@ApiProperty({ type: [TrekkingRouteReviewResponseDto] })
	items!: TrekkingRouteReviewResponseDto[];

	@ApiProperty({ type: TrekkingRoutesPaginationDto })
	pagination!: TrekkingRoutesPaginationDto;
}
