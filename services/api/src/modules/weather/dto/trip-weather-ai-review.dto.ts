import { ApiProperty } from "@nestjs/swagger";
import type { TripWeatherWorstReading } from "../entities/trip-weather-forecast.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";

/** Independent AI opinion attached to a forecast (Host and Admin only). */
export class TripWeatherAiReviewDto {
	@ApiProperty({ enum: RiskLevel })
	level!: RiskLevel;

	@ApiProperty({ description: "Short Vietnamese reason given by the AI" })
	reason!: string;

	@ApiProperty({ minimum: 0, maximum: 1 })
	confidence!: number;

	@ApiProperty()
	reviewedAt!: Date;

	@ApiProperty({ description: "True when the AI agrees with the rule-based level" })
	matchesRule!: boolean;

	@ApiProperty({ type: Date, nullable: true })
	acknowledgedAt!: Date | null;
}

export class TripWeatherAiMismatchDto {
	@ApiProperty({ format: "uuid" })
	forecastId!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	tripTitle!: string;

	@ApiProperty()
	tripStatus!: string;

	@ApiProperty()
	tripStartsAt!: Date;

	@ApiProperty({ format: "uuid" })
	hostId!: string;

	@ApiProperty({ type: String, nullable: true })
	hostName!: string | null;

	@ApiProperty({ enum: RiskLevel, description: "Official level from the thresholds" })
	riskLevel!: RiskLevel;

	@ApiProperty({ enum: RiskLevel, description: "AI opinion on the same readings" })
	aiRiskLevel!: RiskLevel;

	@ApiProperty()
	aiReason!: string;

	@ApiProperty({ minimum: 0, maximum: 1 })
	aiConfidence!: number;

	@ApiProperty()
	aiReviewedAt!: Date;

	@ApiProperty({ description: "1 = one level apart, 2 = Green vs Red" })
	gap!: number;

	@ApiProperty({ type: "object", additionalProperties: true, nullable: true })
	worstReading!: TripWeatherWorstReading | null;

	@ApiProperty({ type: Number, nullable: true, description: "Threshold rule version used" })
	ruleVersion!: number | null;
}

export class TripWeatherAiAcknowledgeResponseDto {
	@ApiProperty({ format: "uuid" })
	forecastId!: string;

	@ApiProperty()
	acknowledgedAt!: Date;
}
