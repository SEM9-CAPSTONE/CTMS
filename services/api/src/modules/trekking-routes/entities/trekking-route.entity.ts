import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Checkpoint } from "./checkpoint.entity";

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

export function isRouteEligibleForNewTrip(status: TrekkingRouteStatus): boolean {
	return status === TrekkingRouteStatus.ACTIVE;
}

export interface GeoLineString {
	type: "LineString";
	coordinates: Array<[number, number]>;
}

export enum TrekkingRouteDrawingMode {
	SMART = "smart",
	MANUAL = "manual",
}

export interface TrekkingRouteDrawing {
	mode: TrekkingRouteDrawingMode | "hybrid";
	waypoints: GeoLineString["coordinates"];
	segments?: TrekkingRouteDrawingSegment[];
}

export interface TrekkingRouteDrawingSegment {
	id: string;
	mode: TrekkingRouteDrawingMode;
	endIndex: number;
}

@Entity({ name: "trekking_routes" })
export class TrekkingRoute {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "host_id" })
	host!: User;

	@OneToMany(
		() => Checkpoint,
		(checkpoint) => checkpoint.route
	)
	checkpoints?: Checkpoint[];

	@Column({ type: "varchar", length: 150 })
	name!: string;

	@Column({ type: "text", nullable: true })
	description!: string | null;

	@Column({ name: "route_geom", type: "geography", spatialFeatureType: "LineString", srid: 4326 })
	routeGeom!: GeoLineString;

	@Column({ name: "route_drawing", type: "jsonb", nullable: true })
	routeDrawing!: TrekkingRouteDrawing | null;

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
