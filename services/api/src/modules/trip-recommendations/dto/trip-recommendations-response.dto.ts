import { ApiProperty } from "@nestjs/swagger";
import { TripSummaryResponseDto } from "../../trips/dto/trip-response.dto";
import type { HealthBasis, TripHealthAssessment } from "../trip-health-assessment";
import {
	RECOMMENDATION_REASONS,
	type RecommendationMode,
	type RecommendationReason,
} from "../trip-recommendation.policy";

export class TripRecommendationItemDto {
	@ApiProperty({
		description: "Evidence-based comparison of the saved activity profile with this Trip",
	})
	healthAssessment!: TripHealthAssessment;
	@ApiProperty({ type: TripSummaryResponseDto })
	trip!: TripSummaryResponseDto;

	@ApiProperty({ enum: RECOMMENDATION_REASONS, isArray: true, maxItems: 2 })
	reasons!: RecommendationReason[];
}

export class TripRecommendationsResponseDto {
	@ApiProperty({
		nullable: true,
		required: false,
		description: "Current saved health facts used by the server, never sent to the external AI",
	})
	healthBasis?: HealthBasis;
	@ApiProperty({
		enum: ["ready", "needs_preferences", "needs_health_consent"],
		description:
			"needs_health_consent: create a health profile and enable sharing before generating suggestions",
	})
	status!: "ready" | "needs_preferences" | "needs_health_consent";

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
