import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Campsite } from "./campsite.entity";

/**
 * CTMS-17-T01 (CTMS-77). Provisional, same caveat as {@link Campsite}.
 * CTMS-15 (Manage Campsite Images) owns full CRUD for this table; Search
 * Campsites only ever reads the lowest `displayOrder` row per campsite as
 * the "representative image" (BR-048).
 */
@Entity({ name: "campsite_images" })
export class CampsiteImage {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "campsite_id", type: "uuid" })
	campsiteId!: string;

	@ManyToOne(() => Campsite, { onDelete: "CASCADE" })
	@JoinColumn({ name: "campsite_id" })
	campsite!: Campsite;

	@Column({ type: "varchar", length: 2000 })
	url!: string;

	@Column({ type: "varchar", length: 50, default: "photo" })
	type!: string;

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder!: number;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
