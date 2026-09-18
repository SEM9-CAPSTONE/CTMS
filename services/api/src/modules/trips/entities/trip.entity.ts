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
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";
import { User } from "../../users/entities/user.entity";
import { TripWaypoint } from "./trip-waypoint.entity";

export enum TripStatus {
	DRAFT = "draft",
	PENDING_APPROVAL = "pending_approval",
	PUBLISHED = "published",
	ONGOING = "ongoing",
	COMPLETED = "completed",
	CANCELLED = "cancelled",
}

export enum TripType {
	DAY_TRIP = "day_trip",
	OVERNIGHT = "overnight",
}

export interface GeoPoint {
	type: "Point";
	coordinates: [number, number];
}

@Entity({ name: "trips" })
export class Trip {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "host_id", type: "uuid" })
	hostId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "host_id" })
	host!: User;

	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "route_id" })
	route!: TrekkingRoute;

	@OneToMany(
		() => TripWaypoint,
		(waypoint) => waypoint.trip
	)
	waypoints?: TripWaypoint[];

	@Column({ type: "varchar", length: 150 })
	title!: string;

	@Column({ type: "text", nullable: true })
	description!: string | null;

	@Column({ name: "cover_image_url", type: "varchar", length: 500, nullable: true })
	coverImageUrl!: string | null;

	@Column({ type: "jsonb", nullable: true })
	itinerary!: Record<string, unknown> | null;

	@Column({ type: "jsonb", nullable: true })
	includes!: Record<string, unknown> | null;

	@Column({ type: "jsonb", nullable: true })
	excludes!: Record<string, unknown> | null;

	@Column({ name: "trip_type", type: "enum", enum: TripType, enumName: "trip_type" })
	tripType!: TripType;

	@Column({ name: "duration_nights", type: "int" })
	durationNights!: number;

	@Column({ name: "starts_at", type: "timestamptz" })
	startsAt!: Date;

	@Column({ name: "ends_at", type: "timestamptz" })
	endsAt!: Date;

	@Column({ name: "meeting_point", type: "geography", spatialFeatureType: "Point", srid: 4326 })
	meetingPoint!: GeoPoint;

	@Column({ name: "meeting_at", type: "timestamptz", nullable: true })
	meetingAt!: Date | null;

	@Column({ name: "booking_deadline", type: "timestamptz" })
	bookingDeadline!: Date;

	@Column({ name: "capacity_min", type: "int" })
	capacityMin!: number;

	@Column({ name: "capacity_max", type: "int", nullable: true })
	capacityMax!: number | null;

	@Column({ name: "seats_taken", type: "int", default: 0 })
	seatsTaken!: number;

	@Column({ name: "price_per_person", type: "numeric", precision: 12, scale: 2 })
	pricePerPerson!: string;

	@Column({ name: "cancellation_policy", type: "jsonb", nullable: true })
	cancellationPolicy!: Record<string, unknown> | null;

	@Column({ type: "enum", enum: TripStatus, enumName: "trip_status", default: TripStatus.DRAFT })
	status!: TripStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
