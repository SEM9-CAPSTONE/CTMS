import { ApiProperty } from "@nestjs/swagger";
import { CheckpointResponseDto } from "./checkpoint-response.dto";
import { TrekkingRouteResponseDto } from "./trekking-route-response.dto";

export class TrekkingRouteReviewResponseDto extends TrekkingRouteResponseDto {
	@ApiProperty({ description: "Owning campsite name used as Admin review context" })
	campsiteName!: string;

	@ApiProperty({ type: CheckpointResponseDto, isArray: true })
	checkpoints!: CheckpointResponseDto[];
}
