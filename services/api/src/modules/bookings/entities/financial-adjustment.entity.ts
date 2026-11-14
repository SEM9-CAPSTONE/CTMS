import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Booking } from "../../profiles/entities/booking.entity";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";
import { Payment } from "./payment.entity";
import { Payout } from "./payout.entity";
import { Settlement } from "./settlement.entity";

export enum FinancialAdjustmentType {
	POST_SETTLEMENT_REFUND = "post_settlement_refund",
	POST_PAYOUT_RECOVERY = "post_payout_recovery",
}

export enum FinancialAdjustmentStatus {
	PENDING = "pending",
	RESOLVED = "resolved",
}

/**
 * CTMS-114 (CTMS-302 / BR-345).
 * Financial reconciliation exception record created after a Settlement or Payout has occurred.
 *
 * Immutability rule: Settled and paid-out historical records are never altered or deleted.
 * All compensations/recoveries are recorded as distinct ledger entries with full auditability
 * and traceability back to source Settlement, Payout, Booking, and Trip.
 */
@Entity({ name: "financial_adjustments" })
export class FinancialAdjustment {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "refund_payment_id", type: "uuid", nullable: true, unique: true })
	refundPaymentId!: string | null;

	@ManyToOne(() => Payment, { nullable: true, onDelete: "RESTRICT" })
	@JoinColumn({ name: "refund_payment_id" })
	refundPayment!: Payment | null;

	@Column({ name: "settlement_id", type: "uuid", nullable: true })
	settlementId!: string | null;

	@ManyToOne(() => Settlement, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({
		name: "settlement_id",
		foreignKeyConstraintName: "FK_financial_adjustments_settle",
	})
	settlement!: Settlement | null;

	@Column({ name: "payout_id", type: "uuid", nullable: true })
	payoutId!: string | null;

	@ManyToOne(() => Payout, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({
		name: "payout_id",
		foreignKeyConstraintName: "FK_financial_adjustments_payout",
	})
	payout!: Payout | null;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@ManyToOne(() => Booking, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "booking_id",
		foreignKeyConstraintName: "FK_financial_adjustments_booking",
	})
	booking!: Booking;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "trip_id",
		foreignKeyConstraintName: "FK_financial_adjustments_trip",
	})
	trip!: Trip;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "host_id",
		foreignKeyConstraintName: "FK_financial_adjustments_host",
	})
	host!: User;

	@Column({ type: "varchar", length: 50 })
	type!: FinancialAdjustmentType;

	@Column({ type: "numeric", precision: 12, scale: 2 })
	amount!: string;

	@Column({ type: "text" })
	reason!: string;

	@Column({ type: "varchar", length: 32, default: FinancialAdjustmentStatus.PENDING })
	status!: FinancialAdjustmentStatus;

	@Column({ name: "idempotency_key", type: "varchar", length: 255, unique: true })
	idempotencyKey!: string;

	@Column({ name: "actor_id", type: "uuid", nullable: true })
	actorId!: string | null;

	@Column({ type: "text", nullable: true })
	notes!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
