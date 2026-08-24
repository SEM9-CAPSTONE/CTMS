import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Campsite, type GeoPoint } from "./campsite.entity";

export enum ZoneStatus {
	ACTIVE = "active",
	CLOSED = "closed",
	ARCHIVED = "archived",
}

@Entity({ name: "campsite_zones" })
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

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
	location!: GeoPoint;

	@Column({ name: "max_tents", type: "int" })
	maxTents!: number;

	@Column({ name: "max_people", type: "int" })
	maxPeople!: number;

	@Column({ name: "base_price", type: "numeric", precision: 12, scale: 2 })
	basePrice!: string;

	@Column({ type: "jsonb", nullable: true })
	amenities!: string[] | null;

	@Column({ name: "terrain_note", type: "text", nullable: true })
	terrainNote!: string | null;

	@Column({ type: "enum", enum: ZoneStatus, enumName: "zone_status", default: ZoneStatus.ACTIVE })
	status!: ZoneStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
