import { ApiProperty } from "@nestjs/swagger";
import { CheckpointResponseDto } from "./checkpoint-response.dto";
import { RouteDangerZoneResponseDto } from "./route-danger-zone-response.dto";
import { TrekkingRouteResponseDto } from "./trekking-route-response.dto";

export class TrekkingRouteReviewResponseDto extends TrekkingRouteResponseDto {
	@ApiProperty({ type: CheckpointResponseDto, isArray: true })
	checkpoints!: CheckpointResponseDto[];

	@ApiProperty({ type: RouteDangerZoneResponseDto, isArray: true })
	dangerZones!: RouteDangerZoneResponseDto[];
}
