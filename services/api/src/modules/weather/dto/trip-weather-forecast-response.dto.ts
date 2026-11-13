import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
	type TripWeatherWorstReading,
} from "../entities/trip-weather-forecast.entity";
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
} from "../entities/weather-risk-assessment.entity";
import { TripWeatherAiReviewDto } from "./trip-weather-ai-review.dto";

export class TripWeatherAdviceDto {
	@ApiProperty()
	text!: string;

	@ApiProperty({ type: [String] })
	actions!: string[];

	@ApiProperty()
	generatedAt!: Date;
}

export class TripWeatherForecastResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: TripWeatherForecastStatus })
	status!: TripWeatherForecastStatus;

	@ApiProperty({ description: "Trip schedule the forecast was made for" })
	tripStartsAt!: Date;

	@ApiProperty()
	tripEndsAt!: Date;

	@ApiProperty({ type: Date, nullable: true })
	forecastFrom!: Date | null;

	@ApiProperty({ type: Date, nullable: true })
	forecastTo!: Date | null;

	@ApiProperty({
		description: "False when part of the Trip lies beyond the forecast horizon or already passed",
	})
	coversWholeTrip!: boolean;

	@ApiProperty({ type: "object", additionalProperties: true, nullable: true })
	worstReading!: TripWeatherWorstReading | null;

	@ApiProperty({ enum: RiskLevel, nullable: true })
	riskLevel!: RiskLevel | null;

	@ApiProperty({ type: Number, nullable: true })
	compositeScore!: number | null;

	@ApiProperty({ type: "object", additionalProperties: true, nullable: true })
	criteriaScores!: WeatherCriteriaScoresDetail | null;

	@ApiPropertyOptional({ type: TripWeatherAdviceDto, nullable: true })
	advice!: TripWeatherAdviceDto | null;

	@ApiPropertyOptional({
		type: TripWeatherAiReviewDto,
		nullable: true,
		description:
			"Independent AI opinion on the same readings (Host/Admin only). Informational: riskLevel stays official.",
	})
	aiReview!: TripWeatherAiReviewDto | null;

	@ApiProperty({ description: "Forecast horizon in days used for this result" })
	horizonDays!: number;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty({
		description: "When this result was last confirmed; an unchanged re-check only moves this",
	})
	checkedAt!: Date;
}

export function toTripWeatherForecastResponse(
	forecast: TripWeatherForecast,
	horizonDays: number,
	options: { includeAiReview?: boolean } = {}
): TripWeatherForecastResponseDto {
	const coversWholeTrip =
		forecast.status === TripWeatherForecastStatus.AVAILABLE &&
		forecast.forecastFrom !== null &&
		forecast.forecastTo !== null &&
		forecast.forecastFrom.getTime() <= forecast.tripStartsAt.getTime() &&
		forecast.forecastTo.getTime() >= floorToHour(forecast.tripEndsAt).getTime();
	return {
		id: forecast.id,
		tripId: forecast.tripId,
		status: forecast.status,
		tripStartsAt: forecast.tripStartsAt,
		tripEndsAt: forecast.tripEndsAt,
		forecastFrom: forecast.forecastFrom,
		forecastTo: forecast.forecastTo,
		coversWholeTrip,
		worstReading: forecast.worstReading,
		riskLevel: forecast.riskLevel,
		compositeScore: forecast.compositeScore,
		criteriaScores: forecast.criteriaScores,
		advice:
			forecast.adviceText && forecast.adviceGeneratedAt
				? {
						text: forecast.adviceText,
						actions: forecast.adviceActions ?? [],
						generatedAt: forecast.adviceGeneratedAt,
					}
				: null,
		aiReview:
			options.includeAiReview && forecast.aiRiskLevel && forecast.aiReviewedAt
				? {
						level: forecast.aiRiskLevel,
						reason: forecast.aiReason ?? "",
						confidence: Number(forecast.aiConfidence ?? 0),
						reviewedAt: forecast.aiReviewedAt,
						matchesRule: forecast.aiRiskLevel === forecast.riskLevel,
						acknowledgedAt: forecast.aiReviewAcknowledgedAt ?? null,
					}
				: null,
		horizonDays,
		createdAt: forecast.createdAt,
		checkedAt: forecast.checkedAt ?? forecast.createdAt,
	};
}

function floorToHour(date: Date): Date {
	const copy = new Date(date.getTime());
	copy.setUTCMinutes(0, 0, 0);
	return copy;
}
