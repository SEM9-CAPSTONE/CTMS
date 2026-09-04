import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { TrekkingRoute } from "./trekking-route.entity";

export enum RouteDangerZoneSeverity {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
}

export interface DangerZonePoint {
	type: "Point";
	coordinates: [number, number];
}

export interface DangerZonePolygon {
	type: "Polygon";
	coordinates: Array<Array<[number, number]>>;
}

export type RouteDangerZoneGeometry = DangerZonePoint | DangerZonePolygon;

@Entity({ name: "route_danger_zones" })
export class RouteDangerZone {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@Column({ name: "geom", type: "geography", spatialFeatureType: "Geometry", srid: 4326 })
	geometry!: RouteDangerZoneGeometry;

	@Column({ name: "radius_m", type: "double precision", nullable: true })
	radiusMeters!: number | null;

	@Column({ type: "varchar", length: 1000 })
	description!: string;

	@Column({
		type: "enum",
		enum: RouteDangerZoneSeverity,
		enumName: "route_danger_zone_severity",
	})
	severity!: RouteDangerZoneSeverity;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
