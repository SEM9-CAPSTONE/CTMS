import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { RiskLevel, type WeatherCriteriaScoresDetail } from "./weather-risk-assessment.entity";

export enum TripWeatherForecastStatus {
	AVAILABLE = "available",
	/** The Trip starts after the provider's forecast horizon; nothing was fetched. */
	OUT_OF_RANGE = "out_of_range",
}

/** Worst value of each criterion over the forecast window, with the hour it occurs. */
export interface TripWeatherWorstReading {
	rainfallMm: number;
	rainfallAt: string;
	windKph: number;
	windAt: string;
	temperatureC: number;
	temperatureAt: string;
	visibilityM: number;
	visibilityAt: string;
	thunderstorm: boolean;
	thunderstormAt: string | null;
	hoursCovered: number;
}

@Entity({ name: "trip_weather_forecasts" })
export class TripWeatherForecast {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@Column({
		type: "enum",
		enum: TripWeatherForecastStatus,
		enumName: "trip_weather_forecast_status",
	})
	status!: TripWeatherForecastStatus;

	@Column({ name: "trip_starts_at", type: "timestamptz" })
	tripStartsAt!: Date;

	@Column({ name: "trip_ends_at", type: "timestamptz" })
	tripEndsAt!: Date;

	@Column({ name: "forecast_from", type: "timestamptz", nullable: true })
	forecastFrom!: Date | null;

	@Column({ name: "forecast_to", type: "timestamptz", nullable: true })
	forecastTo!: Date | null;

	@Column({ name: "worst_reading", type: "jsonb", nullable: true })
	worstReading!: TripWeatherWorstReading | null;

	@Column({ name: "rule_version_id", type: "uuid", nullable: true })
	ruleVersionId!: string | null;

	@Column({
		name: "risk_level",
		type: "enum",
		enum: RiskLevel,
		enumName: "weather_risk_level",
		nullable: true,
	})
	riskLevel!: RiskLevel | null;

	@Column({ name: "composite_score", type: "double precision", nullable: true })
	compositeScore!: number | null;

	@Column({ name: "criteria_scores", type: "jsonb", nullable: true })
	criteriaScores!: WeatherCriteriaScoresDetail | null;

	@Column({ name: "provider_response", type: "jsonb", nullable: true })
	providerResponse!: Record<string, unknown> | null;

	@Column({ name: "advice_text", type: "text", nullable: true })
	adviceText!: string | null;

	@Column({ name: "advice_actions", type: "jsonb", nullable: true })
	adviceActions!: string[] | null;

	@Column({ name: "advice_generated_at", type: "timestamptz", nullable: true })
	adviceGeneratedAt!: Date | null;

	/** Independent AI opinion on the same raw readings; never replaces `riskLevel`. */
	@Column({
		name: "ai_risk_level",
		type: "enum",
		enum: RiskLevel,
		enumName: "weather_risk_level",
		nullable: true,
	})
	aiRiskLevel!: RiskLevel | null;

	@Column({ name: "ai_reason", type: "text", nullable: true })
	aiReason!: string | null;

	@Column({ name: "ai_confidence", type: "double precision", nullable: true })
	aiConfidence!: number | null;

	@Column({ name: "ai_model", type: "varchar", length: 200, nullable: true })
	aiModel!: string | null;

	@Column({ name: "ai_reviewed_at", type: "timestamptz", nullable: true })
	aiReviewedAt!: Date | null;

	@Column({ name: "ai_review_attempts", type: "smallint", default: 0 })
	aiReviewAttempts!: number;

	@Column({ name: "ai_review_acknowledged_at", type: "timestamptz", nullable: true })
	aiReviewAcknowledgedAt!: Date | null;

	@Column({ name: "ai_review_acknowledged_by", type: "uuid", nullable: true })
	aiReviewAcknowledgedBy!: string | null;

	@Column({ name: "created_by", type: "uuid" })
	createdBy!: string;

	/** When this result was last confirmed; an unchanged re-check only moves this (CTMS-93 monitoring). */
	@Column({ name: "checked_at", type: "timestamptz", default: () => "now()" })
	checkedAt!: Date;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
