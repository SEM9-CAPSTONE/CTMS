import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import {
	OverbookingEvaluationGateName,
	OverbookingEvaluationScenarioType,
	OverbookingEvaluationStatus,
} from "../overbooking-evaluation.enums";

export class RunOverbookingEvaluationDto {
	@ApiPropertyOptional({
		description: "Evaluation dataset version",
		example: "v3.0.0-overbooking-prevention",
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
		description: "Sub-list of scenarios to execute. Defaults to all 5 scenarios.",
		enum: OverbookingEvaluationScenarioType,
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsEnum(OverbookingEvaluationScenarioType, { each: true })
	scenarios?: OverbookingEvaluationScenarioType[];

	@ApiPropertyOptional({
		description: "Concurrency multiplier or requests scale factor (1-50)",
		example: 10,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(50)
	concurrencyScale?: number;
}

export class OverbookingGateResultDto {
	@ApiProperty({ description: "Gate identifier", enum: OverbookingEvaluationGateName })
	gateName!: string;

	@ApiProperty({ description: "Required threshold", example: 0 })
	threshold!: number;

	@ApiProperty({ description: "Actual measured value", example: 0 })
	actual!: number;

	@ApiProperty({ description: "Whether the gate passed", example: true })
	passed!: boolean;

	@ApiPropertyOptional({ description: "Unit of measurement", example: "violations" })
	unit?: string;
}

export class OverbookingMetricSummaryDto {
	@ApiProperty({ description: "Total scenarios executed", example: 5 })
	totalScenarios!: number;

	@ApiProperty({ description: "Total concurrent booking requests attempted", example: 40 })
	totalRequests!: number;

	@ApiProperty({ description: "Total bookings successfully created and confirmed", example: 14 })
	successfulBookings!: number;

	@ApiProperty({
		description: "Total requests rejected due to full capacity (BR-276, AC2)",
		example: 22,
	})
	rejectedFullCapacity!: number;

	@ApiProperty({
		description: "Total transaction serialization/locking conflicts recorded (BR-276, AC2)",
		example: 0,
	})
	transactionConflicts!: number;

	@ApiProperty({
		description: "Total transaction retries recorded (BR-276, AC2)",
		example: 0,
	})
	transactionRetries!: number;

	@ApiProperty({ description: "Total seats requested across all attempts", example: 52 })
	totalSeatsRequested!: number;

	@ApiProperty({ description: "Total seats allocated across all successful bookings", example: 14 })
	totalSeatsAllocated!: number;

	@ApiProperty({
		description:
			"Release gate metric: count of cases where seats_taken exceeded capacity_max (AC3)",
		example: 0,
	})
	overbookingCount!: number;

	@ApiProperty({
		description: "Average locking/transaction latency in milliseconds (AC2, AC4)",
		example: 18.5,
	})
	avgLockLatencyMs!: number;

	@ApiProperty({
		description: "Max locking/transaction latency in milliseconds (AC2, AC4)",
		example: 45.2,
	})
	maxLockLatencyMs!: number;

	@ApiProperty({
		description: "P95 locking/transaction latency in milliseconds (AC2, AC4)",
		example: 32.1,
	})
	p95LockLatencyMs!: number;

	@ApiProperty({
		description: "Min locking/transaction latency in milliseconds (AC2, AC4)",
		example: 4.0,
	})
	minLockLatencyMs!: number;

	@ApiProperty({
		description: "Count of errors categorized by rejection/failure code",
		example: { FULL_CAPACITY_CONFLICT: 22 },
	})
	errorsBreakdown!: Record<string, number>;
}

export class OverbookingScenarioExecutionResultDto {
	@ApiProperty({ description: "Scenario type", enum: OverbookingEvaluationScenarioType })
	scenario!: string;

	@ApiProperty({ description: "Human-readable scenario description" })
	description!: string;

	@ApiProperty({ description: "Trip maximum capacity evaluated", example: 5 })
	tripCapacity!: number;

	@ApiProperty({ description: "Seats taken before scenario execution", example: 0 })
	initialSeatsTaken!: number;

	@ApiProperty({ description: "Seats taken after scenario execution", example: 5 })
	finalSeatsTaken!: number;

	@ApiProperty({ description: "Concurrent requests attempted in this scenario", example: 10 })
	totalRequests!: number;

	@ApiProperty({ description: "Successful bookings created", example: 5 })
	successfulRequests!: number;

	@ApiProperty({ description: "Bookings rejected due to full capacity", example: 5 })
	rejectedRequests!: number;

	@ApiProperty({
		description: "Count of invariant violations (seats_taken > capacity_max)",
		example: 0,
	})
	overbookingViolations!: number;

	@ApiProperty({ description: "Average locking latency in ms for this scenario", example: 12.4 })
	avgLockLatencyMs!: number;

	@ApiProperty({ description: "Whether this scenario passed the invariant gate", example: true })
	passed!: boolean;

	@ApiProperty({ description: "Detailed execution breakdown", type: Object })
	details!: Record<string, unknown>;
}

export class OverbookingEvaluationReportResponseDto {
	@ApiProperty({ description: "Report UUID", example: "123e4567-e89b-12d3-a456-426614174000" })
	id!: string;

	@ApiProperty({ description: "Dataset version", example: "v3.0.0-overbooking-prevention" })
	datasetVersion!: string;

	@ApiProperty({ description: "Configuration version", example: "v3" })
	configVersion!: string;

	@ApiProperty({
		description: "Business rules version evaluated",
		example: "BR-276+BR-282+BR-067+BR-071",
	})
	ruleVersion!: string;

	@ApiProperty({
		description: "Overall evaluation conclusion (BR-282, AC3)",
		enum: OverbookingEvaluationStatus,
		example: OverbookingEvaluationStatus.PASSED,
	})
	overallResult!: OverbookingEvaluationStatus;

	@ApiProperty({ description: "Evaluation execution timestamp" })
	evaluatedAt!: Date;

	@ApiProperty({ description: "Release gates status", type: Object })
	gates!: Record<string, OverbookingGateResultDto>;

	@ApiProperty({
		description: "Operational contention and contention metrics",
		type: OverbookingMetricSummaryDto,
	})
	metrics!: OverbookingMetricSummaryDto;

	@ApiProperty({
		description: "Scenario breakdown",
		type: [OverbookingScenarioExecutionResultDto],
	})
	scenarioResults!: OverbookingScenarioExecutionResultDto[];

	@ApiProperty({ description: "Failure reasons if release gate failed", type: [String] })
	failureReasons!: string[];

	@ApiPropertyOptional({ description: "Evaluator user ID if authenticated" })
	evaluatorId!: string | null;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;
}
