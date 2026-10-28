import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { SyncEvaluationStatus } from "../sync-evaluation.enums";

export interface GateResult {
	gateName: string;
	threshold: number;
	actual: number;
	passed: boolean;
	unit?: string;
}

export interface MetricSummary {
	totalRecordsProcessed: number;
	validRecordsCount: number;
	validRecordsAccepted: number;
	validRecordsAcceptanceRate: number;
	safetyEventsTotal: number;
	safetyEventsLost: number;
	authoritativeDuplicatesCount: number;
	retryCount: number;
	avgBatchDelayMs: number;
	maxBatchDelayMs: number;
	p95BatchDelayMs: number;
	errorsBreakdown: Record<string, number>;
}

export interface ScenarioExecutionResult {
	scenario: string;
	description: string;
	recordsCount: number;
	passed: boolean;
	details: Record<string, unknown>;
}

@Entity({ name: "sync_evaluation_reports" })
export class SyncEvaluationReportEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "dataset_version", type: "varchar", length: 64 })
	datasetVersion!: string;

	@Column({ name: "config_version", type: "varchar", length: 32 })
	configVersion!: string;

	@Column({ name: "rule_version", type: "varchar", length: 64 })
	ruleVersion!: string;

	@Column({
		name: "overall_result",
		type: "varchar",
		length: 16,
	})
	@Index("IDX_sync_evaluation_reports_overall_result")
	overallResult!: SyncEvaluationStatus;

	@Column({ name: "evaluated_at", type: "timestamptz" })
	evaluatedAt!: Date;

	@Column({ type: "jsonb" })
	gates!: Record<string, GateResult>;

	@Column({ type: "jsonb" })
	metrics!: MetricSummary;

	@Column({ name: "scenario_results", type: "jsonb" })
	scenarioResults!: ScenarioExecutionResult[];

	@Column({ name: "failure_reasons", type: "jsonb", default: () => "'[]'" })
	failureReasons!: string[];

	@Column({ name: "evaluator_id", type: "uuid", nullable: true })
	evaluatorId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
