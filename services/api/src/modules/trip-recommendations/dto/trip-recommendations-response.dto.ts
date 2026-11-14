import { ApiProperty } from "@nestjs/swagger";
import { TripSummaryResponseDto } from "../../trips/dto/trip-response.dto";
import {
	RECOMMENDATION_REASONS,
	type RecommendationMode,
	type RecommendationReason,
} from "../trip-recommendation.policy";

export class TripRecommendationItemDto {
	@ApiProperty({ type: TripSummaryResponseDto })
	trip!: TripSummaryResponseDto;

	@ApiProperty({ enum: RECOMMENDATION_REASONS, isArray: true, maxItems: 2 })
	reasons!: RecommendationReason[];
}

export class TripRecommendationsResponseDto {
	@ApiProperty({
		enum: ["ready", "needs_preferences"],
		description:
			"needs_preferences: the Camper has no preferences and no booking history yet, so nothing is generated",
	})
	status!: "ready" | "needs_preferences";

	@ApiProperty({ type: TripRecommendationItemDto, isArray: true, maxItems: 6 })
	items!: TripRecommendationItemDto[];

	@ApiProperty()
	generatedAt!: Date;

	@ApiProperty({
		enum: ["ai", "rules"],
		nullable: true,
		description: "ai: ranked by the AI service; rules: base score order (AI not used or failed)",
	})
	mode!: RecommendationMode | null;
}
