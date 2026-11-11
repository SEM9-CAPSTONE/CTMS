import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AspectType } from "../trip-review-moderation.types";

export class AspectSentimentSummaryDto {
	@ApiProperty({ description: "Count of distinct reviews expressing positive sentiment" })
	positive!: number;

	@ApiProperty({ description: "Count of distinct reviews expressing neutral sentiment" })
	neutral!: number;

	@ApiProperty({ description: "Count of distinct reviews expressing negative sentiment" })
	negative!: number;

	@ApiProperty({
		nullable: true,
		description:
			"Calculated net sentiment percentage (positive / total aspect mentions). Null if sample is insufficient.",
	})
	netScore!: number | null;
}

export class TripFeedbackItemDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	tripTitle!: string;

	@ApiPropertyOptional({ format: "uuid" })
	routeId?: string;

	@ApiPropertyOptional()
	routeName?: string;

	@ApiProperty({
		description: "Total eligible reviews (target = 'trip' and moderation_status = 'visible')",
	})
	totalReviews!: number;

	@ApiProperty({ description: "Number of reviews successfully analyzed by the AI pipeline" })
	analyzedReviewsCount!: number;

	@ApiProperty({
		description: "Ratio of analyzed reviews to total eligible reviews (0.0 to 1.0)",
	})
	coverageRate!: number;

	@ApiProperty({
		description: "Count of reviews excluded from analytics due to non-rejected content reports",
	})
	reportedReviewsExcludedCount!: number;

	@ApiProperty({
		description: "True when total eligible reviews >= 5 (DASHBOARD_TRIP_MIN_SAMPLE_SIZE threshold)",
	})
	hasSufficientSample!: boolean;

	@ApiProperty({
		description: "Sentiment breakdown for each of the 4 approved aspect categories",
	})
	aspects!: Record<AspectType, AspectSentimentSummaryDto>;
}

export class TripFeedbackOverviewResponseDto {
	@ApiProperty({ type: [TripFeedbackItemDto] })
	items!: TripFeedbackItemDto[];

	@ApiProperty()
	total!: number;

	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty({
		description: "Operational caution threshold required to activate rankings/scores (5)",
	})
	sampleThreshold!: number;
}
