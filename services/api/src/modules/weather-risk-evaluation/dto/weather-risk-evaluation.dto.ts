import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import type { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskEvaluationReportEntity } from "../entities/weather-risk-evaluation-report.entity";
import {
	WeatherManualAssessmentDatasetStatus,
	WeatherRiskEvaluationGateName,
	WeatherRiskEvaluationStatus,
} from "../weather-risk-evaluation.enums";

export class RunWeatherRiskEvaluationDto {
	@ApiPropertyOptional({
		description: "Manual-assessment dataset version; defaults to the newest one",
		example: "v1-2026-11-draft",
	})
	@IsOptional()
	@IsString()
	@MaxLength(64)
	datasetVersion?: string;

	@ApiPropertyOptional({
		description: "Weather Risk rule version to evaluate; defaults to the active rule",
		example: 1,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	ruleVersion?: number;
}

export class WeatherRiskGateResultDto {
	@ApiProperty({ enum: WeatherRiskEvaluationGateName })
	gateName!: WeatherRiskEvaluationGateName;

	@ApiProperty({ description: "Required value as a fraction 0..1", example: 0.9 })
	threshold!: number;

	@ApiProperty({
		description: "Measured value as a fraction 0..1; null when it cannot be measured",
		example: 0.9167,
		nullable: true,
		type: Number,
	})
	actual!: number | null;

	@ApiProperty({ enum: [">=", "<="] })
	comparator!: ">=" | "<=";

	@ApiProperty({ example: true })
	passed!: boolean;

	@ApiProperty({ example: "ratio" })
	unit!: "ratio";
}

export class WeatherRiskEvaluationReportResponseDto {
	@ApiProperty() id!: string;
	@ApiProperty({ example: "v1-2026-11-draft" }) datasetVersion!: string;
	@ApiProperty({ description: "SHA-256 of the dataset content" }) datasetHash!: string;
	@ApiProperty({ enum: WeatherManualAssessmentDatasetStatus })
	datasetStatus!: WeatherManualAssessmentDatasetStatus;
	@ApiProperty({ example: "v3-weather-risk-evaluation-1" }) configVersion!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) ruleId!: string | null;
	@ApiProperty({ example: 1 }) ruleVersion!: number;
	@ApiProperty({ description: "Thresholds, weights and score caps used", type: Object })
	ruleSnapshot!: Record<string, number | boolean>;
	@ApiProperty({ enum: WeatherRiskEvaluationStatus })
	overallResult!: WeatherRiskEvaluationStatus;
	@ApiProperty() evaluatedAt!: string;
	@ApiProperty({
		description: "OVERALL_AGREEMENT, MISSED_RED_RATE and FALSE_RED_RATE",
		type: Object,
	})
	gates!: Record<WeatherRiskEvaluationGateName, WeatherRiskGateResultDto>;
	@ApiProperty({
		description:
			"Agreement, missed/false Red counts and rates, Green/Yellow/Red breakdown and the observational boundary-case slices",
		type: Object,
	})
	metrics!: WeatherRiskEvaluationReportEntity["metrics"];
	@ApiProperty({ description: "Manual vs automated level of every case", type: [Object] })
	caseResults!: WeatherRiskEvaluationReportEntity["caseResults"];
	@ApiProperty({ type: [String] }) failureReasons!: string[];
	@ApiPropertyOptional({ nullable: true, type: String }) evaluatorId!: string | null;
}

export class WeatherManualAssessmentDatasetSummaryDto {
	@ApiProperty({ example: "v1-2026-11-draft" }) version!: string;
	@ApiProperty({ enum: WeatherManualAssessmentDatasetStatus })
	status!: WeatherManualAssessmentDatasetStatus;
	@ApiProperty() description!: string;
	@ApiPropertyOptional({ nullable: true, type: String }) approvedBy!: string | null;
	@ApiPropertyOptional({ nullable: true, type: String }) approvedAt!: string | null;
	@ApiProperty() hash!: string;
	@ApiProperty({ example: 60 }) totalCases!: number;
	@ApiProperty({ example: 20 }) boundaryCases!: number;
	@ApiProperty({
		description: "Cases per manual level",
		type: Object,
		example: { green: 20, yellow: 20, red: 20 },
	})
	casesByLevel!: Record<RiskLevel, number>;
}

export function toWeatherRiskEvaluationReportDto(
	report: WeatherRiskEvaluationReportEntity
): WeatherRiskEvaluationReportResponseDto {
	return {
		id: report.id,
		datasetVersion: report.datasetVersion,
		datasetHash: report.datasetHash,
		datasetStatus: report.datasetStatus,
		configVersion: report.configVersion,
		ruleId: report.ruleId,
		ruleVersion: report.ruleVersion,
		ruleSnapshot: report.ruleSnapshot,
		overallResult: report.overallResult,
		evaluatedAt: new Date(report.evaluatedAt).toISOString(),
		gates: report.gates,
		metrics: report.metrics,
		caseResults: report.caseResults,
		failureReasons: report.failureReasons,
		evaluatorId: report.evaluatorId,
	};
}
