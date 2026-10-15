import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Trip } from "../../trips/entities/trip.entity";
import { HostWallet } from "./host-wallet.entity";
import { Payout } from "./payout.entity";
import { Settlement } from "./settlement.entity";

export enum WalletTransactionType {
	SETTLEMENT_CREDIT = "settlement_credit",
	PAYOUT_DEBIT = "payout_debit",
	PAYOUT_REFUND = "payout_refund",
}

/**
 * CTMS-112 (CTMS-300 / CTMS-421).
 * Immutable ledger entry recording each mutation on a Host's wallet balance.
 */
@Entity({ name: "wallet_transactions" })
export class WalletTransaction {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "wallet_id", type: "uuid" })
	walletId!: string;

	@ManyToOne(() => HostWallet, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "wallet_id", foreignKeyConstraintName: "FK_wallet_transactions_wallet_id" })
	wallet!: HostWallet;

	@Column({ name: "settlement_id", type: "uuid", nullable: true })
	settlementId!: string | null;

	@ManyToOne(() => Settlement, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({
		name: "settlement_id",
		foreignKeyConstraintName: "FK_wallet_transactions_settlement_id",
	})
	settlement!: Settlement | null;

	@Column({ name: "payout_id", type: "uuid", nullable: true })
	payoutId!: string | null;

	@ManyToOne(() => Payout, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({ name: "payout_id", foreignKeyConstraintName: "FK_wallet_transactions_payout_id" })
	payout!: Payout | null;

	@Column({ name: "trip_id", type: "uuid", nullable: true })
	tripId!: string | null;

	@ManyToOne(() => Trip, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_wallet_transactions_trip_id" })
	trip!: Trip | null;

	@Column({ type: "varchar", length: 32 })
	type!: WalletTransactionType;

	@Column({ name: "base_amount", type: "numeric", precision: 12, scale: 2, default: "0.00" })
	baseAmount!: string;

	@Column({ name: "fee_amount", type: "numeric", precision: 12, scale: 2, default: "0.00" })
	feeAmount!: string;

	@Column({ name: "net_amount", type: "numeric", precision: 12, scale: 2 })
	netAmount!: string;

	@Column({ name: "balance_after", type: "numeric", precision: 12, scale: 2 })
	balanceAfter!: string;

	@Column({ type: "varchar", length: 255 })
	description!: string;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
