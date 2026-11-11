import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * CTMS-112 (CTMS-300 / CTMS-421).
 * Host's financial wallet storing available settled balance.
 */
@Entity({ name: "host_wallets" })
export class HostWallet {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid", unique: true })
	hostId!: string;

	@OneToOne(() => User, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "host_id", foreignKeyConstraintName: "FK_host_wallets_host_id" })
	host!: User;

	@Column({ type: "numeric", precision: 12, scale: 2, default: "0.00" })
	balance!: string;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
