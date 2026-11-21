import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import type {
	RealtimeEvaluationMetrics,
	RealtimeEvaluationReportEntity,
	RealtimeScenarioResult,
} from "../entities/realtime-evaluation-report.entity";
import { REALTIME_EVALUATION_LIMITS as L } from "../realtime-evaluation.constants";
import { RealtimeEvaluationGateName, RealtimeEvaluationStatus } from "../realtime-evaluation.enums";

export class RunRealtimeEvaluationDto {
	@ApiPropertyOptional({ description: "Measured SOS events", example: L.sosEvents.default })
	@IsOptional()
	@IsInt()
	@Min(L.sosEvents.min)
	@Max(L.sosEvents.max)
	sosEvents?: number;

	@ApiPropertyOptional({
		description: "Measured normal events per client",
		example: L.normalEvents.default,
	})
	@IsOptional()
	@IsInt()
	@Min(L.normalEvents.min)
	@Max(L.normalEvents.max)
	normalEvents?: number;

	@ApiPropertyOptional({
		description: "Clients connected at once",
		example: L.concurrentClients.default,
	})
	@IsOptional()
	@IsInt()
	@Min(L.concurrentClients.min)
	@Max(L.concurrentClients.max)
	concurrentClients?: number;

	@ApiPropertyOptional({
		description: "Events published while a client is offline",
		example: L.missedEvents.default,
	})
	@IsOptional()
	@IsInt()
	@Min(L.missedEvents.min)
	@Max(L.missedEvents.max)
	missedEvents?: number;
}

export class RealtimeGateResultDto {
	@ApiProperty({ enum: RealtimeEvaluationGateName }) gateName!: RealtimeEvaluationGateName;
	@ApiProperty({ example: 5000 }) threshold!: number;
	@ApiProperty({ nullable: true, type: Number, example: 12 }) actual!: number | null;
	@ApiProperty({ enum: ["<", "<=", ">="] }) comparator!: "<" | "<=" | ">=";
	@ApiProperty({ enum: ["ms", "ratio"] }) unit!: "ms" | "ratio";
	@ApiProperty() passed!: boolean;
}

export class RealtimeEvaluationReportResponseDto {
	@ApiProperty() id!: string;
	@ApiProperty({ example: "v3.0.0-realtime-performance" }) scenarioVersion!: string;
	@ApiProperty({ example: "v3-realtime-evaluation-1" }) configVersion!: string;
	@ApiProperty({ example: "BR-281+BR-265+BR-282" }) ruleVersion!: string;
	@ApiProperty({
		description: "Run parameters, stable-connection rule and reconnect policy",
		type: Object,
	})
	testConfig!: Record<string, unknown>;
	@ApiProperty({ enum: RealtimeEvaluationStatus }) overallResult!: RealtimeEvaluationStatus;
	@ApiProperty() startedAt!: string;
	@ApiProperty() evaluatedAt!: string;
	@ApiProperty({
		description: "SOS_DELIVERY_P95, NORMAL_EVENT_P95, NORMAL_EVENT_P99, MISSED_EVENT_RECOVERY",
		type: Object,
	})
	gates!: Record<RealtimeEvaluationGateName, RealtimeGateResultDto>;
	@ApiProperty({
		description: "SOS / normal latency stats, recovery and observational metrics",
		type: Object,
	})
	metrics!: RealtimeEvaluationMetrics;
	@ApiProperty({ type: [Object] }) scenarioResults!: RealtimeScenarioResult[];
	@ApiProperty({ type: [String] }) failureReasons!: string[];
	@ApiPropertyOptional({ nullable: true, type: String }) evaluatorId!: string | null;
	@ApiProperty({
		description: "Timing samples stored for this report (payload never stored)",
		example: 2131,
	})
	sampleCount!: number;
}

export function toRealtimeEvaluationReportDto(
	report: RealtimeEvaluationReportEntity,
	sampleCount: number
): RealtimeEvaluationReportResponseDto {
	return {
		id: report.id,
		scenarioVersion: report.scenarioVersion,
		configVersion: report.configVersion,
		ruleVersion: report.ruleVersion,
		testConfig: report.testConfig,
		overallResult: report.overallResult,
		startedAt: new Date(report.startedAt).toISOString(),
		evaluatedAt: new Date(report.evaluatedAt).toISOString(),
		gates: report.gates,
		metrics: report.metrics,
		scenarioResults: report.scenarioResults,
		failureReasons: report.failureReasons,
		evaluatorId: report.evaluatorId,
		sampleCount,
	};
}
