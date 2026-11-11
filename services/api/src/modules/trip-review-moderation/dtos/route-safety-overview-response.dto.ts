import { ApiProperty } from "@nestjs/swagger";
import type { IncidentSeverity, IncidentType } from "../trip-review-moderation.types";

export class IncidentSeverityBreakdownDto {
	@ApiProperty()
	minor!: number;

	@ApiProperty()
	moderate!: number;

	@ApiProperty()
	severe!: number;

	@ApiProperty()
	unknown!: number;
}

export class IncidentSignalSummaryDto {
	@ApiProperty({
		enum: ["fall_slip", "injury", "lost_path", "weather_hazard", "other"],
	})
	category!: IncidentType;

	@ApiProperty({
		description:
			"Count of distinct reviews where this incident type actually occurred (occurred = 'yes')",
	})
	occurredCount!: number;

	@ApiProperty({
		description:
			"Count of distinct reviews offering preventive advice or caution without an event occurring (occurred = 'warning')",
	})
	warningCount!: number;

	@ApiProperty({
		description:
			"Count of distinct reviews where occurrence context is ambiguous (occurred = 'unknown')",
	})
	unknownCount!: number;

	@ApiProperty({
		description: "Severity distribution for occurred incidents",
	})
	severityBreakdown!: Record<IncidentSeverity, number>;

	@ApiProperty({
		type: [String],
		description: "Up to 3 recent verbatim masked excerpts cited by campers",
	})
	sampleQuotes!: string[];
}

export class RouteSafetyItemDto {
	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty()
	routeName!: string;

	@ApiProperty({
		description:
			"Total eligible reviews across trips on this route (target = 'trip' and moderation_status = 'visible')",
	})
	totalReviews!: number;

	@ApiProperty({ description: "Number of reviews successfully analyzed for safety incidents" })
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
		description:
			"True when total eligible reviews >= 10 (DASHBOARD_SAFETY_MIN_SAMPLE_SIZE threshold)",
	})
	hasSufficientSample!: boolean;

	@ApiProperty({
		description:
			"Total distinct reviews describing at least one actual incident (COUNT(DISTINCT review_id) where occurred = 'yes')",
	})
	totalDistinctReviewsWithIncidents!: number;

	@ApiProperty({
		description:
			"Total distinct reviews describing preventive cautions/warnings (COUNT(DISTINCT review_id) where occurred = 'warning')",
	})
	totalDistinctReviewsWithWarnings!: number;

	@ApiProperty({
		type: [IncidentSignalSummaryDto],
		description: "Incident signals breakdown by approved category",
	})
	incidentSignals!: IncidentSignalSummaryDto[];
}

export class RouteSafetyOverviewResponseDto {
	@ApiProperty({ type: [RouteSafetyItemDto] })
	items!: RouteSafetyItemDto[];

	@ApiProperty()
	total!: number;

	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty({
		description: "Operational caution threshold required to activate rankings/scores (10)",
	})
	sampleThreshold!: number;

	@ApiProperty({
		description:
			"Invariant reminder: category counts cannot be summed together because one review may mention multiple categories",
	})
	categoryCountsCannotBeSummed!: boolean;

	@ApiProperty({
		description:
			"Contract assertion: safety signals from reviews do NOT constitute Potential Safety Hotspots",
	})
	notSafetyHotspots!: boolean;
}
