import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Campsite } from "./campsite.entity";

/** CTMS-12/BR-033: a zone's own status, independent of the campsite's. */
export enum ZoneStatus {
	ACTIVE = "active",
	CLOSED = "closed",
}

/**
 * CTMS-17-T01 (CTMS-77). Provisional, same caveat as {@link Campsite} --
 * only the columns Search Campsites' filters actually read (BR-046:
 * amenities, zone base-price range).
 */
@Entity({ name: "zones" })
export class Zone {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "campsite_id", type: "uuid" })
	campsiteId!: string;

	@ManyToOne(() => Campsite, { onDelete: "CASCADE" })
	@JoinColumn({ name: "campsite_id" })
	campsite!: Campsite;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "int" })
	capacity!: number;

	@Column({ type: "varchar", length: 200 })
	location!: string;

	@Column({ name: "base_price", type: "numeric", precision: 12, scale: 2 })
	basePrice!: string;

	/**
	 * Postgres native `text[]`, not jsonb -- lets the search repository use
	 * the `&&` (overlap) operator directly for the frozen "ANY matching
	 * zone" amenities semantics (a campsite matches if at least one of its
	 * zones has at least one of the requested amenities).
	 */
	@Column({ type: "text", array: true, default: () => "'{}'" })
	amenities!: string[];

	@Column({ type: "enum", enum: ZoneStatus, default: ZoneStatus.ACTIVE })
	status!: ZoneStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
