import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";
import { User } from "../../users/entities/user.entity";
import { WeatherRiskRule } from "./weather-risk-rule.entity";
import { WeatherSnapshot } from "./weather-snapshot.entity";

export enum RiskLevel {
	GREEN = "green",
	YELLOW = "yellow",
	RED = "red",
}

export interface CriterionRiskScoreDetail {
	value: number | boolean;
	level: RiskLevel;
	weight: number;
	score: number; // 0, 1, or 2
}

export interface WeatherCriteriaScoresDetail {
	rainfall: CriterionRiskScoreDetail;
	wind: CriterionRiskScoreDetail;
	temperature: CriterionRiskScoreDetail;
	visibility: CriterionRiskScoreDetail;
	thunderstorm: CriterionRiskScoreDetail;
}

@Entity({ name: "weather_risk_assessments" })
@Index("IDX_weather_risk_assessments_route_id", ["routeId"])
@Index("IDX_weather_risk_assessments_snapshot_id", ["snapshotId"])
export class WeatherRiskAssessment {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "CASCADE" })
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@Column({ name: "snapshot_id", type: "uuid" })
	snapshotId!: string;

	@ManyToOne(() => WeatherSnapshot, { onDelete: "CASCADE" })
	@JoinColumn({ name: "snapshot_id" })
	snapshot!: WeatherSnapshot;

	@Column({ name: "rule_version_id", type: "uuid" })
	ruleVersionId!: string;

	@ManyToOne(() => WeatherRiskRule, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "rule_version_id" })
	rule!: WeatherRiskRule;

	@Column({ name: "risk_level", type: "enum", enum: RiskLevel, enumName: "weather_risk_level" })
	riskLevel!: RiskLevel;

	@Column({ name: "composite_score", type: "double precision" })
	compositeScore!: number;

	@Column({ name: "criteria_scores", type: "jsonb" })
	criteriaScores!: WeatherCriteriaScoresDetail;

	@Column({ name: "created_by", type: "uuid" })
	createdBy!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "created_by" })
	creator!: User;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
