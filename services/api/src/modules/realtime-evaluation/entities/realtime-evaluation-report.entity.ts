import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type {
	RealtimeEvaluationGateName,
	RealtimeEvaluationStatus,
} from "../realtime-evaluation.enums";
import type {
	LatencyStats,
	RealtimeGateResult,
	RecoveryStats,
} from "../realtime-evaluation.metrics";

export interface RealtimeEvaluationMetrics {
	sos: LatencyStats;
	normal: LatencyStats;
	recovery: RecoveryStats & { truncated: boolean };
	/** Observational only (AC6/AC7): never a release gate. */
	observations: {
		concurrentClients: number;
		normalEventsPerSecond: number | null;
		averageAckMs: number | null;
		duplicateCopiesFiltered: number;
	};
}

export interface RealtimeScenarioResult {
	scenario: string;
	description: string;
	passed: boolean;
	details: Record<string, unknown>;
}

/** CTMS-100 / BR-281, BR-282: one real-time performance evaluation and its conclusion. */
@Entity({ name: "realtime_evaluation_reports" })
export class RealtimeEvaluationReportEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "scenario_version", type: "varchar", length: 64 })
	scenarioVersion!: string;

	@Column({ name: "config_version", type: "varchar", length: 64 })
	configVersion!: string;

	@Column({ name: "rule_version", type: "varchar", length: 64 })
	ruleVersion!: string;

	/** Run parameters, stable-connection rule and reconnect policy in force (BR-282). */
	@Column({ name: "test_config", type: "jsonb" })
	testConfig!: Record<string, unknown>;

	@Column({ name: "overall_result", type: "varchar", length: 16 })
	@Index("IDX_realtime_evaluation_reports_overall_result")
	overallResult!: RealtimeEvaluationStatus;

	@Column({ name: "started_at", type: "timestamptz" })
	startedAt!: Date;

	@Column({ name: "evaluated_at", type: "timestamptz" })
	evaluatedAt!: Date;

	@Column({ type: "jsonb" })
	gates!: Record<RealtimeEvaluationGateName, RealtimeGateResult>;

	@Column({ type: "jsonb" })
	metrics!: RealtimeEvaluationMetrics;

	@Column({ name: "scenario_results", type: "jsonb" })
	scenarioResults!: RealtimeScenarioResult[];

	@Column({ name: "failure_reasons", type: "jsonb", default: () => "'[]'" })
	failureReasons!: string[];

	@Column({ name: "evaluator_id", type: "uuid", nullable: true })
	evaluatorId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
