import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from "typeorm";
import type { ValueTransformer } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PorterRouteProficiency } from "./porter-route-qualification.entity";

export enum PorterAvailabilityStatus {
	AVAILABLE = "available",
	UNAVAILABLE = "unavailable",
}

const numericTransformer: ValueTransformer = {
	to: (value: number): number => value,
	from: (value: string | number): number => Number(value),
};

@Entity({ name: "porter_profiles" })
export class PorterProfile {
	@PrimaryColumn({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@OneToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({ name: "experience_years", type: "integer", default: 0 })
	experienceYears!: number;

	@Column({ type: "text", array: true, default: () => "'{}'" })
	certifications!: string[];

	@Column({ type: "text", array: true, default: () => "'{}'" })
	languages!: string[];

	@Column({
		name: "availability_status",
		type: "enum",
		enum: PorterAvailabilityStatus,
		enumName: "porter_availability_status",
		default: PorterAvailabilityStatus.UNAVAILABLE,
	})
	availabilityStatus!: PorterAvailabilityStatus;

	@Column({
		name: "rating_avg",
		type: "numeric",
		precision: 3,
		scale: 2,
		default: 0,
		transformer: numericTransformer,
	})
	ratingAvg!: number;

	@Column({ name: "completed_trips", type: "integer", default: 0 })
	completedTrips!: number;

	@Column({
		name: "porter_level",
		type: "enum",
		enum: PorterRouteProficiency,
		enumName: "porter_route_proficiency",
		default: PorterRouteProficiency.LEARNING,
	})
	porterLevel!: PorterRouteProficiency;

	@Column({ name: "level_verified_by", type: "uuid", nullable: true })
	levelVerifiedBy!: string | null;

	@Column({ name: "level_verified_at", type: "timestamptz", nullable: true })
	levelVerifiedAt!: Date | null;

	@Column({ type: "integer", default: 1 })
	version!: number;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
