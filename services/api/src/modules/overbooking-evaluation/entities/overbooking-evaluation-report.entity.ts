import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { OverbookingEvaluationStatus } from "../overbooking-evaluation.enums";

export interface GateResult {
	gateName: string;
	threshold: number;
	actual: number;
	passed: boolean;
	unit?: string;
}

export interface OverbookingMetricSummary {
	totalScenarios: number;
	totalRequests: number;
	successfulBookings: number;
	rejectedFullCapacity: number;
	transactionConflicts: number;
	transactionRetries: number;
	totalSeatsRequested: number;
	totalSeatsAllocated: number;
	overbookingCount: number;
	avgLockLatencyMs: number;
	maxLockLatencyMs: number;
	p95LockLatencyMs: number;
	minLockLatencyMs: number;
	errorsBreakdown: Record<string, number>;
}

export interface OverbookingScenarioExecutionResult {
	scenario: string;
	description: string;
	tripCapacity: number;
	initialSeatsTaken: number;
	finalSeatsTaken: number;
	totalRequests: number;
	successfulRequests: number;
	rejectedRequests: number;
	overbookingViolations: number;
	avgLockLatencyMs: number;
	passed: boolean;
	details: Record<string, unknown>;
}

@Entity({ name: "overbooking_evaluation_reports" })
export class OverbookingEvaluationReportEntity {
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
	@Index("IDX_overbooking_evaluation_reports_overall_result")
	overallResult!: OverbookingEvaluationStatus;

	@Column({ name: "evaluated_at", type: "timestamptz" })
	evaluatedAt!: Date;

	@Column({ type: "jsonb" })
	gates!: Record<string, GateResult>;

	@Column({ type: "jsonb" })
	metrics!: OverbookingMetricSummary;

	@Column({ name: "scenario_results", type: "jsonb" })
	scenarioResults!: OverbookingScenarioExecutionResult[];

	@Column({ name: "failure_reasons", type: "jsonb", default: () => "'[]'" })
	failureReasons!: string[];

	@Column({ name: "evaluator_id", type: "uuid", nullable: true })
	evaluatorId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
