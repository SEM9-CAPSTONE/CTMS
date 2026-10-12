import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { GeoPoint } from "../../trekking-routes/entities/checkpoint.entity";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";
import { GpsParticipantRole } from "../gps-tracking.enums";

/**
 * CTMS-059. One persisted GPS breadcrumb. Rows are append-only: there is no
 * update or delete path, and `id` is the client-generated UUID (BR-244).
 */
@Entity({ name: "gps_logs" })
export class GpsLog {
	@PrimaryColumn({ type: "uuid" })
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_gps_logs_trip_id" })
	trip?: Trip;

	@Column({ name: "user_id", type: "uuid" })
	userId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "user_id", foreignKeyConstraintName: "FK_gps_logs_user_id" })
	user?: User;

	@Column({
		name: "participant_role",
		type: "enum",
		enum: GpsParticipantRole,
		enumName: "gps_participant_role",
	})
	participantRole!: GpsParticipantRole;

	/** Capture time of the original sample on the device, never the upload time (BR-396). */
	@Column({ name: "event_time", type: "timestamptz" })
	eventTime!: Date;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
	location!: GeoPoint;

	@Column({ name: "accuracy_meters", type: "double precision" })
	accuracyMeters!: number;

	@Column({ name: "altitude_meters", type: "double precision", nullable: true })
	altitudeMeters!: number | null;

	@Column({ name: "battery_level", type: "smallint", nullable: true })
	batteryLevel!: number | null;

	@Column({ name: "package_version", type: "varchar", length: 64, nullable: true })
	packageVersion!: string | null;

	@Column({ name: "config_version", type: "varchar", length: 32 })
	configVersion!: string;

	/** When the server accepted the log; distinguishes synced data from device-only data (BR-226). */
	@CreateDateColumn({ name: "received_at", type: "timestamptz" })
	receivedAt!: Date;
}
