import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Booking } from "../../profiles/entities/booking.entity";

export enum PaymentType {
	CHARGE = "charge",
	REFUND = "refund",
}

export enum PaymentStatus {
	PENDING = "pending",
	SUCCEEDED = "succeeded",
	FAILED = "failed",
}

export enum PaymentTransactionStatus {
	PENDING = "pending",
	SUCCEEDED = "succeeded",
	FAILED = "failed",
}

/**
 * CTMS-032-T01. Authoritative ledger record for a Booking charge or refund.
 *
 * One Payment row is created per unique (booking_id, idempotency_key) pair.
 * Status starts at `pending`, transitions to `succeeded` or `failed` once the
 * provider result is known. Booking.status / Booking.paymentStatus are only
 * updated inside the same transaction as the succeeded charge (BR-091,
 * BR-176, BR-177).
 *
 * The `amount` column is an immutable server-side snapshot of
 * `Booking.totalAmount` at pay-time so auditors can reconstruct the charged
 * figure independently of later edits to the Booking total (BR-175).
 */
@Entity({ name: "payments" })
@Check("CHK_payments_amount_positive", `"amount" > 0`)
@Check("CHK_payments_refund_has_parent", `"type" <> 'refund' OR "parent_payment_id" IS NOT NULL`)
export class Payment {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@ManyToOne(() => Booking, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "booking_id", foreignKeyConstraintName: "FK_payments_booking_id" })
	booking!: Booking;

	/** Server-computed snapshot of Booking.totalAmount at pay-time (BR-175). Never client-supplied. */
	@Column({ type: "numeric", precision: 12, scale: 2 })
	amount!: string;

	@Column({ type: "enum", enum: PaymentType, enumName: "payment_type" })
	type!: PaymentType;

	@Column({ type: "enum", enum: PaymentStatus, enumName: "payment_status" })
	status!: PaymentStatus;

	/** Camper-supplied, scoped to booking_id. Enforced unique by DB index (BR-178). */
	@Column({ name: "idempotency_key", type: "varchar", length: 128, nullable: true })
	idempotencyKey!: string | null;

	/** SHA-256 of (bookingId, type, method) — detects payload mismatch on replay (BR-178). */
	@Column({ name: "request_fingerprint", type: "varchar", length: 64, nullable: true })
	requestFingerprint!: string | null;

	/** Provider-assigned transaction reference, populated after provider call. */
	@Column({ name: "provider_reference", type: "varchar", length: 255, nullable: true })
	providerReference!: string | null;

	/** Non-null only for refund Payments; references the original charge Payment. */
	@Column({ name: "parent_payment_id", type: "uuid", nullable: true })
	parentPaymentId!: string | null;

	@ManyToOne(() => Payment, { nullable: true, onDelete: "RESTRICT" })
	@JoinColumn({
		name: "parent_payment_id",
		foreignKeyConstraintName: "FK_payments_parent_payment_id",
	})
	parentPayment!: Payment | null;

	@OneToMany(
		() => PaymentTransaction,
		(txn) => txn.payment
	)
	transactions!: PaymentTransaction[];

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}

/**
 * CTMS-032-T01. One row per provider callback / charge attempt for a Payment.
 * Tracks raw provider responses for audit without exposing secrets in logs
 * (BR-200, BR-274).
 */
@Entity({ name: "payment_transactions" })
export class PaymentTransaction {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "payment_id", type: "uuid" })
	paymentId!: string;

	@ManyToOne(
		() => Payment,
		(payment) => payment.transactions,
		{
			nullable: false,
			onDelete: "CASCADE",
		}
	)
	@JoinColumn({
		name: "payment_id",
		foreignKeyConstraintName: "FK_payment_transactions_payment_id",
	})
	payment!: Payment;

	/** Provider-assigned reference for this transaction attempt. */
	@Column({ name: "transaction_ref", type: "varchar", length: 255, nullable: true })
	transactionRef!: string | null;

	@Column({
		type: "enum",
		enum: PaymentTransactionStatus,
		enumName: "payment_transaction_status",
	})
	status!: PaymentTransactionStatus;

	/** Sanitised provider callback body — must not contain secrets or PII (BR-200). */
	@Column({ name: "raw_payload", type: "jsonb", nullable: true })
	rawPayload!: Record<string, unknown> | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
