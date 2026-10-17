import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { GeoPoint } from "../../trekking-routes/entities/checkpoint.entity";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";
import {
	IncidentCategory,
	IncidentLocationStatus,
	IncidentSeverity,
	IncidentStatus,
} from "../incidents.enums";

/**
 * CTMS-049. One Porter-reported Trip incident. `id` is the client-generated UUID, so an
 * offline report synchronized repeatedly maps to this single row (BR-162, BR-221).
 */
@Entity({ name: "trip_incidents" })
export class TripIncident {
	@PrimaryColumn({ type: "uuid" })
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_trip_incidents_trip_id" })
	trip?: Trip;

	@Column({ name: "reporter_id", type: "uuid" })
	reporterId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "reporter_id", foreignKeyConstraintName: "FK_trip_incidents_reporter_id" })
	reporter?: User;

	@Column({ type: "enum", enum: IncidentCategory, enumName: "incident_category" })
	category!: IncidentCategory;

	@Column({ type: "enum", enum: IncidentSeverity, enumName: "incident_severity" })
	severity!: IncidentSeverity;

	@Column({
		type: "enum",
		enum: IncidentStatus,
		enumName: "incident_status",
		default: IncidentStatus.OPEN,
	})
	status!: IncidentStatus;

	@Column({ type: "varchar", length: 2000 })
	description!: string;

	/** When the incident happened on the device, never the upload time (BR-221). */
	@Column({ name: "occurred_at", type: "timestamptz" })
	occurredAt!: Date;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326, nullable: true })
	location!: GeoPoint | null;

	@Column({ name: "location_accuracy_meters", type: "double precision", nullable: true })
	locationAccuracyMeters!: number | null;

	@Column({ name: "location_captured_at", type: "timestamptz", nullable: true })
	locationCapturedAt!: Date | null;

	@Column({
		name: "location_status",
		type: "enum",
		enum: IncidentLocationStatus,
		enumName: "incident_location_status",
	})
	locationStatus!: IncidentLocationStatus;

	@Column({ name: "captured_offline", type: "boolean", default: false })
	capturedOffline!: boolean;

	@Column({ name: "media_url", type: "varchar", length: 512, nullable: true })
	mediaUrl!: string | null;

	@Column({ name: "media_content_type", type: "varchar", length: 64, nullable: true })
	mediaContentType!: string | null;

	@Column({ name: "media_size_bytes", type: "integer", nullable: true })
	mediaSizeBytes!: number | null;

	@Column({ name: "media_uploaded_at", type: "timestamptz", nullable: true })
	mediaUploadedAt!: Date | null;

	/** When the server first accepted the incident; distinguishes synced from device-only data. */
	@CreateDateColumn({ name: "received_at", type: "timestamptz" })
	receivedAt!: Date;
}
