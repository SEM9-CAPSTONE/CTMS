import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Campsite } from "../../campsites/entities/campsite.entity";

export enum TrekkingRouteDifficulty {
	EASY = "easy",
	MODERATE = "moderate",
	HARD = "hard",
	EXPERT = "expert",
}

export enum TrekkingRouteStatus {
	DRAFT = "draft",
	PENDING_APPROVAL = "pending_approval",
	ACTIVE = "active",
	CLOSED = "closed",
}

export interface GeoLineString {
	type: "LineString";
	coordinates: Array<[number, number]>;
}

@Entity({ name: "trekking_routes" })
export class TrekkingRoute {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "campsite_id", type: "uuid" })
	campsiteId!: string;

	@ManyToOne(() => Campsite, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "campsite_id" })
	campsite!: Campsite;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "text", nullable: true })
	description!: string | null;

	@Column({ name: "route_geom", type: "geography", spatialFeatureType: "LineString", srid: 4326 })
	routeGeom!: GeoLineString;

	@Column({ name: "length_meters", type: "double precision" })
	lengthMeters!: number;

	@Column({
		type: "enum",
		enum: TrekkingRouteDifficulty,
		enumName: "trekking_route_difficulty",
	})
	difficulty!: TrekkingRouteDifficulty;

	@Column({ name: "expected_duration_minutes", type: "int" })
	expectedDurationMinutes!: number;

	@Column({
		type: "enum",
		enum: TrekkingRouteStatus,
		enumName: "trekking_route_status",
		default: TrekkingRouteStatus.DRAFT,
	})
	status!: TrekkingRouteStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
