import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Campsite } from "./campsite.entity";

@Entity({ name: "campsite_media" })
export class CampsiteMedia {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "campsite_id", type: "uuid" })
	campsiteId!: string;

	@ManyToOne(() => Campsite, { onDelete: "CASCADE" })
	@JoinColumn({ name: "campsite_id" })
	campsite!: Campsite;

	@Column({ type: "varchar", length: 2000 })
	url!: string;

	@Column({ type: "varchar", length: 50 })
	type!: string;

	@Column({ name: "sort_order", type: "int" })
	sortOrder!: number;
}
