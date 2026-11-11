import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";

/**
 * CTMS-112 (CTMS-300 / CTMS-421).
 * Immutable financial snapshot of settled Trip revenue, 5% platform fee, and net host entitlement.
 */
@Entity({ name: "settlements" })
export class Settlement {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid", unique: true })
	tripId!: string;

	@OneToOne(() => Trip, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_settlements_trip_id" })
	trip!: Trip;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({ name: "host_id", foreignKeyConstraintName: "FK_settlements_host_id" })
	host!: User;

	@Column({ name: "settlement_base", type: "numeric", precision: 12, scale: 2 })
	settlementBase!: string;

	@Column({ name: "commission_rate", type: "numeric", precision: 5, scale: 4, default: "0.0500" })
	commissionRate!: string;

	@Column({ name: "platform_fee", type: "numeric", precision: 12, scale: 2 })
	platformFee!: string;

	@Column({ name: "net_amount", type: "numeric", precision: 12, scale: 2 })
	netAmount!: string;

	@Column({ name: "settled_at", type: "timestamptz", default: () => "now()" })
	settledAt!: Date;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
