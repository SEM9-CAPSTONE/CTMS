import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export enum CampsiteStatus {
	DRAFT = "draft",
	PENDING_APPROVAL = "pending_approval",
	ACTIVE = "active",
	TEMPORARILY_CLOSED = "temporarily_closed",
	SUSPENDED = "suspended",
	ARCHIVED = "archived",
}

export interface GeoPoint {
	type: "Point";
	coordinates: [number, number];
}

@Entity({ name: "campsites" })
export class Campsite {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "host_id" })
	host!: User;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "text", nullable: true })
	description!: string | null;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
	location!: GeoPoint;

	@Column({ type: "varchar", length: 100 })
	province!: string;

	@Column({ type: "jsonb", nullable: true })
	policies!: Record<string, unknown> | null;

	@Column({ name: "operating_hours", type: "jsonb", nullable: true })
	operatingHours!: Record<string, unknown> | null;

	@Column({ name: "season_start_date", type: "date", nullable: true })
	seasonStartDate!: string | null;

	@Column({ name: "season_end_date", type: "date", nullable: true })
	seasonEndDate!: string | null;

	@Column({ name: "max_advance_booking_days", type: "int", nullable: true })
	maxAdvanceBookingDays!: number | null;

	@Column({ name: "min_nights", type: "int", nullable: true })
	minNights!: number | null;

	@Column({ name: "max_nights", type: "int", nullable: true })
	maxNights!: number | null;

	@Column({
		type: "enum",
		enum: CampsiteStatus,
		enumName: "campsite_status",
		default: CampsiteStatus.DRAFT,
	})
	status!: CampsiteStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
