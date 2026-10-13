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
import type { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { Trip } from "./trip.entity";

export enum PorterRequestStatus {
	PENDING = "pending",
	ACCEPTED = "accepted",
	DECLINED = "declined",
	CANCELLED = "cancelled",
	EXPIRED = "expired",
}

@Entity({ name: "porter_requests" })
export class PorterRequest {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id" })
	trip!: Trip;

	@Column({ name: "porter_id", type: "uuid" })
	porterId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "porter_id" })
	porter!: User;

	@Column({ name: "requested_by", type: "uuid" })
	requestedBy!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "requested_by" })
	requester!: User;

	@Column({ name: "requested_role", type: "varchar", length: 20 })
	requestedRole!: IntendedPorterRole;

	@Column({ type: "varchar", length: 500, nullable: true })
	note!: string | null;

	@Column({
		type: "enum",
		enum: PorterRequestStatus,
		enumName: "porter_request_status",
		default: PorterRequestStatus.PENDING,
	})
	status!: PorterRequestStatus;

	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt!: Date;

	@Column({ name: "responded_at", type: "timestamptz", nullable: true })
	respondedAt!: Date | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
