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
import { HostWallet } from "./host-wallet.entity";

export enum PayoutStatus {
	PENDING = "pending",
	SUCCEEDED = "succeeded",
	FAILED = "failed",
}

/**
 * CTMS-112 / CTMS-113.
 * Represents a Host's payout/withdrawal request from their HostWallet to their bank account.
 */
@Entity({ name: "payouts" })
export class Payout {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "host_id", foreignKeyConstraintName: "FK_payouts_host_id" })
	host!: User;

	@Column({ name: "wallet_id", type: "uuid" })
	walletId!: string;

	@ManyToOne(() => HostWallet, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "wallet_id", foreignKeyConstraintName: "FK_payouts_wallet_id" })
	wallet!: HostWallet;

	@Column({ type: "numeric", precision: 12, scale: 2 })
	amount!: string;

	@Column({ type: "varchar", length: 32, default: PayoutStatus.PENDING })
	status!: PayoutStatus;

	@Column({ name: "bank_name", type: "varchar", length: 100 })
	bankName!: string;

	@Column({ name: "account_number", type: "varchar", length: 50 })
	accountNumber!: string;

	@Column({ name: "account_holder_name", type: "varchar", length: 100 })
	accountHolderName!: string;

	@Column({ name: "transaction_ref", type: "varchar", length: 255, nullable: true })
	transactionRef!: string | null;

	@Column({ name: "rejection_reason", type: "varchar", length: 255, nullable: true })
	rejectionReason!: string | null;

	@Column({ name: "admin_notes", type: "text", nullable: true })
	adminNotes!: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
