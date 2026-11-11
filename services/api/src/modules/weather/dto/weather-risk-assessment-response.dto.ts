import { ApiProperty } from "@nestjs/swagger";
import {
	RiskLevel,
	type WeatherCriteriaScoresDetail,
} from "../entities/weather-risk-assessment.entity";

export class WeatherRiskAssessmentResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty({ format: "uuid" })
	snapshotId!: string;

	@ApiProperty({ format: "uuid" })
	ruleVersionId!: string;

	@ApiProperty({ enum: RiskLevel })
	riskLevel!: RiskLevel;

	@ApiProperty({ type: Number })
	compositeScore!: number;

	@ApiProperty({
		type: "object",
		additionalProperties: true,
		example: {
			rainfall: { value: 12.5, level: "yellow", weight: 0.3, score: 1 },
			wind: { value: 35.0, level: "green", weight: 0.25, score: 0 },
			temperature: { value: 33.0, level: "green", weight: 0.15, score: 0 },
			visibility: { value: 4500, level: "yellow", weight: 0.15, score: 1 },
			thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
		},
	})
	criteriaScores!: WeatherCriteriaScoresDetail;

	@ApiProperty({ format: "uuid" })
	createdBy!: string;

	@ApiProperty({ format: "date-time" })
	createdAt!: Date;
}
