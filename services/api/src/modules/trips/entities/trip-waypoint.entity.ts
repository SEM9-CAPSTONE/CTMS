import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { Checkpoint } from "../../trekking-routes/entities/checkpoint.entity";
import type { GeoPoint } from "./trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected or referenced by TypeORM
import { Trip } from "./trip.entity";

export enum WaypointType {
	START = "start",
	CHECKPOINT = "checkpoint",
	REST = "rest",
	MEAL = "meal",
	ACTIVITY = "activity",
	OVERNIGHT = "overnight",
	FINISH = "finish",
}

@Entity({ name: "trip_waypoints" })
export class TripWaypoint {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trip_id" })
	trip!: Trip;

	@Column({ name: "checkpoint_id", type: "uuid", nullable: true })
	checkpointId!: string | null;

	@ManyToOne(() => Checkpoint, { onDelete: "SET NULL", nullable: true })
	@JoinColumn({ name: "checkpoint_id" })
	checkpoint!: Checkpoint | null;

	@Column({ type: "enum", enum: WaypointType, enumName: "waypoint_type" })
	type!: WaypointType;

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
	location!: GeoPoint;

	@Column({ name: "day_number", type: "int" })
	dayNumber!: number;

	@Column({ name: "sequence_order", type: "int" })
	sequenceOrder!: number;

	@Column({ name: "planned_at", type: "timestamptz", nullable: true })
	plannedAt!: Date | null;

	@Column({ name: "duration_minutes", type: "int", nullable: true })
	durationMinutes!: number | null;

	@Column({ type: "jsonb", nullable: true })
	metadata!: Record<string, unknown> | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
