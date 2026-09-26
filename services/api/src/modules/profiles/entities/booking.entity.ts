import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";

export enum BookingStatus {
	PENDING_PAYMENT = "pending_payment",
	CONFIRMED = "confirmed",
	CANCELLED = "cancelled",
	EXPIRED = "expired",
	COMPLETED = "completed",
}

export enum BookingPaymentStatus {
	NOT_REQUIRED = "not_required",
	UNPAID = "unpaid",
	PAID = "paid",
}

@Entity({ name: "bookings" })
export class Booking {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id" })
	trip!: Trip;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user!: User;

	@Column({ name: "num_people", type: "int", nullable: true })
	numPeople!: number | null;

	@Column({ type: "enum", enum: BookingStatus, enumName: "booking_status", nullable: true })
	status!: BookingStatus | null;

	@Column({
		name: "payment_status",
		type: "enum",
		enum: BookingPaymentStatus,
		enumName: "booking_payment_status",
		nullable: true,
	})
	paymentStatus!: BookingPaymentStatus | null;

	@Column({ name: "hold_expires_at", type: "timestamptz", nullable: true })
	holdExpiresAt!: Date | null;

	@Column({ name: "trip_starts_at_snapshot", type: "timestamptz", nullable: true })
	tripStartsAtSnapshot!: Date | null;

	@Column({ name: "trip_ends_at_snapshot", type: "timestamptz", nullable: true })
	tripEndsAtSnapshot!: Date | null;

	@Column({ name: "base_price", type: "numeric", precision: 12, scale: 2, nullable: true })
	basePrice!: string | null;

	@Column({ name: "cancellation_policy_snapshot", type: "jsonb", nullable: true })
	cancellationPolicySnapshot!: Record<string, unknown> | null;

	@Column({ name: "idempotency_key", type: "varchar", length: 128, nullable: true })
	idempotencyKey!: string | null;

	@Column({ name: "request_fingerprint", type: "varchar", length: 64, nullable: true })
	requestFingerprint!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
