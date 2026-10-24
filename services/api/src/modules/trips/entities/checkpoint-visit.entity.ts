import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { BookingMember } from "../../bookings/entities/booking-member.entity";
import { Checkpoint } from "../../trekking-routes/entities/checkpoint.entity";
import { User } from "../../users/entities/user.entity";
import type { GeoPoint } from "./trip.entity";
import { Trip } from "./trip.entity";

@Entity({ name: "checkpoint_visits" })
export class CheckpointVisit {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id" })
	trip!: Trip;

	@Column({ name: "checkpoint_id", type: "uuid" })
	checkpointId!: string;

	@ManyToOne(() => Checkpoint, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "checkpoint_id" })
	checkpoint!: Checkpoint;

	@Column({ name: "member_id", type: "uuid" })
	memberId!: string;

	@ManyToOne(() => BookingMember, { onDelete: "CASCADE" })
	@JoinColumn({ name: "member_id" })
	member!: BookingMember;

	@Column({ name: "confirmed_by_id", type: "uuid" })
	confirmedById!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "confirmed_by_id" })
	confirmedBy!: User;

	@Column({ name: "arrived_at", type: "timestamptz" })
	arrivedAt!: Date;

	@Column({
		type: "geography",
		spatialFeatureType: "Point",
		srid: 4326,
		nullable: true,
	})
	location!: GeoPoint | null;

	@Column({ name: "captured_offline", type: "boolean", default: false })
	capturedOffline!: boolean;

	@Column({ name: "sync_id", type: "varchar", length: 128, nullable: true })
	syncId!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
