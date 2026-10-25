import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { GpsParticipantRole } from "../../gps-tracking/gps-tracking.enums";
import type { GeoPoint } from "../../trekking-routes/entities/checkpoint.entity";
import { TrekkingRoute } from "../../trekking-routes/entities/trekking-route.entity";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";
import { SafetyEventType } from "../safety-events.enums";

/**
 * CTMS-060. A route-deviation or GPS-quality transition detected on the device and
 * accepted by the server. Rows are append-only and keep the original client context;
 * `id` is the client-generated UUID so repeated uploads map to one row (BR-244).
 */
@Entity({ name: "safety_events" })
export class SafetyEvent {
	@PrimaryColumn({ type: "uuid" })
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_safety_events_trip_id" })
	trip?: Trip;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "user_id", foreignKeyConstraintName: "FK_safety_events_user_id" })
	user?: User;

	@Column({
		name: "participant_role",
		type: "enum",
		enum: GpsParticipantRole,
		enumName: "gps_participant_role",
	})
	participantRole!: GpsParticipantRole;

	@Column({
		name: "event_type",
		type: "enum",
		enum: SafetyEventType,
		enumName: "safety_event_type",
	})
	eventType!: SafetyEventType;

	/** When the device confirmed the transition, never the upload time (BR-243). */
	@Column({ name: "event_time", type: "timestamptz" })
	eventTime!: Date;

	/** Sample that confirmed the transition; optional only for GPS_DEGRADED (last known fix). */
	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326, nullable: true })
	location!: GeoPoint | null;

	@Column({ name: "accuracy_meters", type: "double precision", nullable: true })
	accuracyMeters!: number | null;

	/** Distance computed on the device from the active Route geometry (BR-238); not recomputed here. */
	@Column({ name: "distance_to_route_meters", type: "double precision", nullable: true })
	distanceToRouteMeters!: number | null;

	@Column({ name: "consecutive_valid_samples", type: "smallint", nullable: true })
	consecutiveValidSamples!: number | null;

	/** GPS_DEGRADED only: time of the last VALID sample, or tracking start when there was none. */
	@Column({ name: "no_valid_sample_since", type: "timestamptz", nullable: true })
	noValidSampleSince!: Date | null;

	@Column({ name: "detected_offline", type: "boolean", default: false })
	detectedOffline!: boolean;

	/** The Trip's authoritative Route at acceptance time, resolved by the server. */
	@Column({ name: "route_id", type: "uuid" })
	routeId!: string;

	@ManyToOne(() => TrekkingRoute, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "route_id", foreignKeyConstraintName: "FK_safety_events_route_id" })
	route?: TrekkingRoute;

	/** Fingerprint of the Route geometry the device detected against (BR-360). */
	@Column({ name: "route_version", type: "varchar", length: 64 })
	routeVersion!: string;

	@Column({ name: "package_version", type: "varchar", length: 64, nullable: true })
	packageVersion!: string | null;

	@Column({ name: "config_version", type: "varchar", length: 32 })
	configVersion!: string;

	/** When the server accepted the event; distinguishes synced data from device-only state (BR-226). */
	@CreateDateColumn({ name: "received_at", type: "timestamptz" })
	receivedAt!: Date;
}
