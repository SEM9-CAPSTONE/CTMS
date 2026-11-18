import { ApiProperty } from "@nestjs/swagger";
import type { ReviewReputation } from "./review-reputation";

export class ReviewReputationDto implements ReviewReputation {
	@ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 5 })
	ratingAverage!: number | null;

	@ApiProperty({ type: Number, minimum: 0 })
	ratingCount!: number;
}
