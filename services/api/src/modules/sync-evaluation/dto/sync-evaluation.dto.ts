import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import {
	SyncEvaluationGateName,
	SyncEvaluationScenarioType,
	SyncEvaluationStatus,
} from "../sync-evaluation.enums";

export class RunSyncEvaluationDto {
	@ApiPropertyOptional({
		description: "Evaluation dataset version",
		example: "v3.0.0-offline-sync",
	})
	@IsOptional()
	@IsString()
	datasetVersion?: string;

	@ApiPropertyOptional({
		description: "Optional specific Trip ID to evaluate against",
		example: "123e4567-e89b-12d3-a456-426614174000",
	})
	@IsOptional()
	@IsUUID()
	tripId?: string;

	@ApiPropertyOptional({
		description: "Sub-list of scenarios to execute. Defaults to all 6 scenarios.",
		enum: SyncEvaluationScenarioType,
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsEnum(SyncEvaluationScenarioType, { each: true })
	scenarios?: SyncEvaluationScenarioType[];
}

export class GateResultDto {
	@ApiProperty({ description: "Gate identifier", enum: SyncEvaluationGateName })
	gateName!: string;

	@ApiProperty({ description: "Required threshold", example: 1.0 })
	threshold!: number;

	@ApiProperty({ description: "Actual measured value", example: 1.0 })
	actual!: number;

	@ApiProperty({ description: "Whether the gate passed", example: true })
	passed!: boolean;

	@ApiPropertyOptional({ description: "Unit of measurement", example: "%" })
	unit?: string;
}

export class MetricSummaryDto {
	@ApiProperty({ description: "Total records processed across scenarios", example: 250 })
	totalRecordsProcessed!: number;

	@ApiProperty({ description: "Total valid records in batches", example: 200 })
	validRecordsCount!: number;

	@ApiProperty({ description: "Total valid records accepted by server", example: 200 })
	validRecordsAccepted!: number;

	@ApiProperty({ description: "Valid record acceptance rate (0.0 to 1.0)", example: 1.0 })
	validRecordsAcceptanceRate!: number;

	@ApiProperty({ description: "Total confirmed safety events evaluated", example: 40 })
	safetyEventsTotal!: number;

	@ApiProperty({ description: "Total confirmed safety events lost", example: 0 })
	safetyEventsLost!: number;

	@ApiProperty({
		description: "Total authoritative duplicates created after retry/resend",
		example: 0,
	})
	authoritativeDuplicatesCount!: number;

	@ApiProperty({ description: "Total retry attempts recorded", example: 5 })
	retryCount!: number;

	@ApiProperty({ description: "Average batch sync delay in milliseconds", example: 45.2 })
	avgBatchDelayMs!: number;

	@ApiProperty({ description: "Max batch sync delay in milliseconds", example: 120.0 })
	maxBatchDelayMs!: number;

	@ApiProperty({ description: "P95 batch sync delay in milliseconds", example: 85.0 })
	p95BatchDelayMs!: number;

	@ApiProperty({
		description: "Count of errors categorized by rejection reason",
		example: { ROUTE_VERSION_MISMATCH: 2, ID_CONFLICT: 1 },
	})
	errorsBreakdown!: Record<string, number>;
}

export class ScenarioExecutionResultDto {
	@ApiProperty({ description: "Scenario type", enum: SyncEvaluationScenarioType })
	scenario!: string;

	@ApiProperty({ description: "Human-readable scenario description" })
	description!: string;

	@ApiProperty({ description: "Records count tested in this scenario", example: 50 })
	recordsCount!: number;

	@ApiProperty({ description: "Whether this scenario passed all invariants", example: true })
	passed!: boolean;

	@ApiProperty({ description: "Detailed execution metrics", type: Object })
	details!: Record<string, unknown>;
}

export class SyncEvaluationReportResponseDto {
	@ApiProperty({ description: "Report UUID", example: "123e4567-e89b-12d3-a456-426614174000" })
	id!: string;

	@ApiProperty({ description: "Dataset version", example: "v3.0.0-offline-sync" })
	datasetVersion!: string;

	@ApiProperty({ description: "Configuration version", example: "v3" })
	configVersion!: string;

	@ApiProperty({
		description: "Business rules version evaluated",
		example: "BR-278+BR-436+BR-441-443",
	})
	ruleVersion!: string;

	@ApiProperty({
		description: "Overall evaluation conclusion (BR-282)",
		enum: SyncEvaluationStatus,
		example: SyncEvaluationStatus.PASSED,
	})
	overallResult!: SyncEvaluationStatus;

	@ApiProperty({ description: "Evaluation execution timestamp" })
	evaluatedAt!: Date;

	@ApiProperty({ description: "Release gates status", type: Object })
	gates!: Record<string, GateResultDto>;

	@ApiProperty({ description: "Observational metrics", type: MetricSummaryDto })
	metrics!: MetricSummaryDto;

	@ApiProperty({
		description: "Scenario breakdown",
		type: [ScenarioExecutionResultDto],
	})
	scenarioResults!: ScenarioExecutionResultDto[];

	@ApiProperty({ description: "Failure reasons if any gate failed", type: [String] })
	failureReasons!: string[];

	@ApiPropertyOptional({ description: "Evaluator user ID if authenticated" })
	evaluatorId!: string | null;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;
}
