import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { WeatherRiskAssessment } from "./weather-risk-assessment.entity";

/**
 * CTMS-29-T01. One advice per assessment (`UQ_weather_advice_assessment_id`)
 * -- calling the LLM again for the same, already-explained assessment would
 * cost real money for no new information (BR-230's "no duplicate
 * transactions" spirit) and would risk two different pieces of text for
 * the exact same underlying data, undermining reproducibility.
 *
 * Deliberately has no risk-level/score column of its own: this table only
 * ever *explains* `WeatherRiskAssessment`, never restates or overrides it
 * (BR-076) -- a consumer must join back to the assessment for that.
 */
@Entity({ name: "weather_advice" })
@Index("IDX_weather_advice_assessment_id", ["assessmentId"])
export class WeatherAdvice {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "assessment_id", type: "uuid" })
	assessmentId!: string;

	@ManyToOne(() => WeatherRiskAssessment, { onDelete: "CASCADE" })
	@JoinColumn({ name: "assessment_id" })
	assessment!: WeatherRiskAssessment;

	@Column({ name: "advice_text", type: "text" })
	adviceText!: string;

	@Column({ name: "actions", type: "jsonb" })
	actions!: string[];

	@Column({ name: "created_by", type: "uuid" })
	createdBy!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "created_by" })
	creator!: User;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
