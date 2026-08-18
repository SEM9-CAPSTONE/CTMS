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

/**
 * CTMS-17-T01 (CTMS-77). Provisional -- CTMS-50 (Create/manage Campsite,
 * owned by another teammate, not yet merged) is the real source of truth
 * for the full Campsite domain; this entity only carries the columns
 * Search Campsites' AC/BRs actually need. See the migration's doc comment
 * for the same note.
 *
 * BR-045: no "rejected" value exists in `status` -- CTMS-16's rejection
 * flow returns a campsite to `draft`, it does not introduce a new state.
 */
export enum CampsiteStatus {
	DRAFT = "draft",
	PENDING_APPROVAL = "pending_approval",
	ACTIVE = "active",
	SUSPENDED = "suspended",
	CLOSED = "closed",
	ARCHIVED = "archived",
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

	@Column({ type: "varchar", length: 2000 })
	description!: string;

	@Column({ type: "numeric", precision: 9, scale: 6 })
	latitude!: string;

	@Column({ type: "numeric", precision: 9, scale: 6 })
	longitude!: string;

	@Column({ type: "varchar", length: 100 })
	province!: string;

	@Column({ type: "varchar", length: 100 })
	city!: string;

	@Column({ type: "varchar", length: 2000 })
	policies!: string;

	@Column({ name: "operating_hours", type: "varchar", length: 200 })
	operatingHours!: string;

	@Column({ type: "enum", enum: CampsiteStatus, default: CampsiteStatus.DRAFT })
	status!: CampsiteStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
