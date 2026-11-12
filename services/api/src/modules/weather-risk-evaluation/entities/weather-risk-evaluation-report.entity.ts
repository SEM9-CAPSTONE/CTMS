import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type {
	WeatherManualAssessmentDatasetStatus,
	WeatherRiskEvaluationGateName,
	WeatherRiskEvaluationStatus,
} from "../weather-risk-evaluation.enums";
import type {
	WeatherRiskCaseResult,
	WeatherRiskEvaluationMetrics,
	WeatherRiskGateResult,
} from "../weather-risk-evaluation.metrics";

/** Thresholds, weights and score caps of the rule version at the time of the run. */
export type WeatherRuleSnapshot = Record<string, number | boolean>;

/** CTMS-099 / BR-280, BR-282: one comparison of the scorer with a manual-assessment set. */
@Entity({ name: "weather_risk_evaluation_reports" })
@Index("IDX_weather_risk_evaluation_reports_context", ["datasetVersion", "ruleVersion"])
export class WeatherRiskEvaluationReportEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "dataset_version", type: "varchar", length: 64 })
	datasetVersion!: string;

	/** SHA-256 of the dataset content used, so the exact labels can be traced. */
	@Column({ name: "dataset_hash", type: "char", length: 64 })
	datasetHash!: string;

	@Column({ name: "dataset_status", type: "varchar", length: 16 })
	datasetStatus!: WeatherManualAssessmentDatasetStatus;

	@Column({ name: "config_version", type: "varchar", length: 64 })
	configVersion!: string;

	@Column({ name: "rule_id", type: "uuid", nullable: true })
	ruleId!: string | null;

	@Column({ name: "rule_version", type: "integer" })
	ruleVersion!: number;

	@Column({ name: "rule_snapshot", type: "jsonb" })
	ruleSnapshot!: WeatherRuleSnapshot;

	@Column({ name: "overall_result", type: "varchar", length: 16 })
	@Index("IDX_weather_risk_evaluation_reports_overall_result")
	overallResult!: WeatherRiskEvaluationStatus;

	@Column({ name: "evaluated_at", type: "timestamptz" })
	evaluatedAt!: Date;

	@Column({ type: "jsonb" })
	gates!: Record<WeatherRiskEvaluationGateName, WeatherRiskGateResult>;

	@Column({ type: "jsonb" })
	metrics!: WeatherRiskEvaluationMetrics;

	@Column({ name: "case_results", type: "jsonb" })
	caseResults!: WeatherRiskCaseResult[];

	@Column({ name: "failure_reasons", type: "jsonb", default: () => "'[]'" })
	failureReasons!: string[];

	@Column({ name: "evaluator_id", type: "uuid", nullable: true })
	evaluatorId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
