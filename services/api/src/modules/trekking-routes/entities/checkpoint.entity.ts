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

export enum CheckpointType {
	START = "start",
	REST = "rest",
	WATER = "water",
	DANGEROUS = "dangerous",
	EMERGENCY_SHELTER = "emergency_shelter",
	FINISH = "finish",
}

export interface GeoPoint {
	type: "Point";
	coordinates: [number, number];
}

@Entity({ name: "checkpoints" })
export class Checkpoint {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(
		() => TrekkingRoute,
		(route) => route.checkpoints,
		{ onDelete: "RESTRICT" }
	)
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
	location!: GeoPoint;

	@Column({ name: "radius_m", type: "int" })
	radiusMeters!: number;

	@Column({ type: "enum", enum: CheckpointType, enumName: "checkpoint_type" })
	type!: CheckpointType;

	@Column({ name: "expected_arrival_offset", type: "int" })
	expectedArrivalOffset!: number;

	@Column({ type: "varchar", length: 1000 })
	instructions!: string;

	@Column({ name: "nearby_water_or_shelter", type: "boolean" })
	nearbyWaterOrShelter!: boolean;

	@Column({ name: "route_position", type: "double precision" })
	routePosition!: number;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
