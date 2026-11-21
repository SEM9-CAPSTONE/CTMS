import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import type {
	RecommendationFallbackReason,
	RecommendationMode,
	RecommendationReason,
	RecommendationSignalType,
} from "../trip-recommendation.policy";

export interface RecommendationRunResult {
	tripId: string;
	reasons: RecommendationReason[];
}

/** CTMS-106. Metadata of one generation; no prompt, no AI free text, no personal data. */
@Entity({ name: "trip_recommendation_runs" })
export class TripRecommendationRun {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@Column({ name: "generated_at", type: "timestamptz" })
	generatedAt!: Date;

	@Column({ type: "varchar", length: 16 })
	mode!: RecommendationMode;

	@Column({ name: "signal_type", type: "varchar", length: 32 })
	signalType!: RecommendationSignalType;

	@Column({ name: "rules_version", type: "varchar", length: 64 })
	rulesVersion!: string;

	@Column({ name: "prompt_version", type: "varchar", length: 64, nullable: true })
	promptVersion!: string | null;

	@Column({ name: "model_version", type: "varchar", length: 200, nullable: true })
	modelVersion!: string | null;

	@Column({ name: "eligible_count", type: "int" })
	eligibleCount!: number;

	@Column({ name: "candidate_count", type: "int" })
	candidateCount!: number;

	@Column({ type: "jsonb" })
	results!: RecommendationRunResult[];

	@Column({ name: "fallback_reason", type: "varchar", length: 32, nullable: true })
	fallbackReason!: RecommendationFallbackReason | null;

	@Column({ name: "latency_ms", type: "int" })
	latencyMs!: number;

	/** Hash of preferences, aggregated history and versions; set on AI runs. */
	@Column({ name: "signal_fingerprint", type: "varchar", length: 64, nullable: true })
	signalFingerprint!: string | null;

	/** The validated order the AI returned (Trip ids, not codes); only on runs that called the AI. */
	@Column({ name: "ai_ranking", type: "jsonb", nullable: true })
	aiRanking!: RecommendationRunResult[] | null;

	/** Set when this run reused an earlier AI order instead of calling the AI. */
	@Column({ name: "reused_run_id", type: "uuid", nullable: true })
	reusedRunId!: string | null;
}
