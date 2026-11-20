import { ApiProperty } from "@nestjs/swagger";
import type { TripHealthAssessment } from "../trip-health-assessment";
import type {
	ExplanationKind,
	ExplanationSource,
	ExplanationTone,
} from "../trip-recommendation-explanation";
import { RECOMMENDATION_REASONS, type RecommendationReason } from "../trip-recommendation.policy";

const EXPLANATION_KINDS: ExplanationKind[] = [
	"trip_type",
	"fitness",
	"difficulty",
	"health_note",
	"allergy",
	"diet",
	"age",
	"interest",
	"experience",
	"region",
	"price",
	"route",
	"timing",
	"availability",
];

export class TripRecommendationExplanationQuoteDto {
	@ApiProperty({
		enum: ["health_profile", "personal_profile", "trip_preferences", "booking_history"],
	})
	source!: ExplanationSource;

	@ApiProperty({ description: "Vietnamese field name, e.g. Mức thể lực" })
	field!: string;

	@ApiProperty({ description: "What the Camper entered, or the label of the option they chose" })
	text!: string;
}

export class TripRecommendationExplanationSectionDto {
	@ApiProperty({ enum: EXPLANATION_KINDS })
	kind!: ExplanationKind;

	@ApiProperty({
		enum: ["match", "info", "caution"],
		description: "match: why it fits; info: facts; caution: what to weigh before booking",
	})
	tone!: ExplanationTone;

	@ApiProperty({ description: "Vietnamese heading" })
	title!: string;

	@ApiProperty({ type: TripRecommendationExplanationQuoteDto, nullable: true })
	quote!: TripRecommendationExplanationQuoteDto | null;

	@ApiProperty({ description: "How the Trip's stored facts compare with the quote" })
	detail!: string;

	@ApiProperty({ nullable: true, description: "Vietnamese conclusion starting with “Vì vậy”" })
	conclusion!: string | null;
}

export class TripRecommendationExplanationDto {
	@ApiProperty({ description: "Current activity-profile comparison; never a medical clearance" })
	healthAssessment!: TripHealthAssessment;
	@ApiProperty()
	tripTitle!: string;

	@ApiProperty({ enum: RECOMMENDATION_REASONS, isArray: true, maxItems: 2 })
	reasons!: RecommendationReason[];

	@ApiProperty({ type: TripRecommendationExplanationSectionDto, isArray: true })
	sections!: TripRecommendationExplanationSectionDto[];

	@ApiProperty({ description: "Overall Vietnamese conclusion over all sections" })
	summary!: string;

	@ApiProperty({
		description:
			"true when the consented health profile was used; false when consent is off or there is no health profile",
	})
	healthConsidered!: boolean;

	@ApiProperty({ description: "When the suggestion list containing this Trip was generated" })
	generatedAt!: Date;
}
