import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity({ name: "weather_risk_rules" })
export class WeatherRiskRule {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: "integer", generated: "increment" })
	version!: number;

	@Column({ name: "rainfall_yellow_threshold", type: "double precision" })
	rainfallYellowThreshold!: number;

	@Column({ name: "rainfall_red_threshold", type: "double precision" })
	rainfallRedThreshold!: number;

	@Column({ name: "wind_yellow_threshold", type: "double precision" })
	windYellowThreshold!: number;

	@Column({ name: "wind_red_threshold", type: "double precision" })
	windRedThreshold!: number;

	@Column({ name: "temp_low_yellow", type: "double precision" })
	tempLowYellow!: number;

	@Column({ name: "temp_low_red", type: "double precision" })
	tempLowRed!: number;

	@Column({ name: "temp_high_yellow", type: "double precision" })
	tempHighYellow!: number;

	@Column({ name: "temp_high_red", type: "double precision" })
	tempHighRed!: number;

	@Column({ name: "visibility_yellow_threshold", type: "double precision" })
	visibilityYellowThreshold!: number;

	@Column({ name: "visibility_red_threshold", type: "double precision" })
	visibilityRedThreshold!: number;

	@Column({ name: "thunderstorm_yellow", type: "boolean" })
	thunderstormYellow!: boolean;

	@Column({ name: "thunderstorm_red", type: "boolean" })
	thunderstormRed!: boolean;

	@Column({ name: "rainfall_weight", type: "double precision" })
	rainfallWeight!: number;

	@Column({ name: "wind_weight", type: "double precision" })
	windWeight!: number;

	@Column({ name: "temperature_weight", type: "double precision" })
	temperatureWeight!: number;

	@Column({ name: "visibility_weight", type: "double precision" })
	visibilityWeight!: number;

	@Column({ name: "thunderstorm_weight", type: "double precision" })
	thunderstormWeight!: number;

	@Column({ name: "green_max_score", type: "double precision" })
	greenMaxScore!: number;

	@Column({ name: "yellow_max_score", type: "double precision" })
	yellowMaxScore!: number;

	@Column({ name: "is_active", type: "boolean", default: true })
	isActive!: boolean;

	@Column({ name: "created_by", type: "uuid", nullable: true })
	createdBy!: string | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn({ name: "created_by" })
	creator!: User | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
