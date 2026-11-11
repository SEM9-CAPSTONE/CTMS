import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { GeoPoint } from "../../trips/entities/trip.entity";
import { Trip } from "../../trips/entities/trip.entity";
import { User } from "../../users/entities/user.entity";
import { EmergencyType, SosStatus } from "../sos.enums";

/**
 * CTMS-074, CTMS-077, CTMS-080.
 * An SOS alert triggered during a Trip.
 */
@Entity({ name: "sos_alerts" })
export class SosAlert {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@ManyToOne(() => Trip, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "trip_id", foreignKeyConstraintName: "FK_sos_alerts_trip_id" })
	trip?: Trip;

	@Column({ name: "sender_id", type: "uuid" })
	senderId!: string;

	@ManyToOne(() => User, { onDelete: "RESTRICT" })
	@JoinColumn({ name: "sender_id", foreignKeyConstraintName: "FK_sos_alerts_sender_id" })
	sender?: User;

	@Column({
		name: "emergency_type",
		type: "enum",
		enum: EmergencyType,
		enumName: "emergency_type",
	})
	emergencyType!: EmergencyType;

	@Column({ type: "geography", spatialFeatureType: "Point", srid: 4326, nullable: true })
	location!: GeoPoint | null;

	@Column({ name: "battery_level", type: "smallint", nullable: true })
	batteryLevel!: number | null;

	@Column({ name: "event_time", type: "timestamptz" })
	eventTime!: Date;

	@Column({
		type: "enum",
		enum: SosStatus,
		enumName: "sos_status",
		default: SosStatus.ACTIVE,
	})
	status!: SosStatus;

	@Column({ name: "cancelled_by", type: "uuid", nullable: true })
	cancelledBy!: string | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn({ name: "cancelled_by", foreignKeyConstraintName: "FK_sos_alerts_cancelled_by" })
	canceller?: User | null;

	@Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
	cancelledAt!: Date | null;

	@Column({ name: "cancellation_reason", type: "varchar", length: 500, nullable: true })
	cancellationReason!: string | null;

	@Column({ name: "acknowledged_by", type: "uuid", nullable: true })
	acknowledgedBy!: string | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn({
		name: "acknowledged_by",
		foreignKeyConstraintName: "FK_sos_alerts_acknowledged_by",
	})
	acknowledger?: User | null;

	@Column({ name: "acknowledged_at", type: "timestamptz", nullable: true })
	acknowledgedAt!: Date | null;

	@Column({ name: "closed_by", type: "uuid", nullable: true })
	closedBy!: string | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn({ name: "closed_by", foreignKeyConstraintName: "FK_sos_alerts_closed_by" })
	closer?: User | null;

	@Column({ name: "closed_at", type: "timestamptz", nullable: true })
	closedAt!: Date | null;

	@Column({ name: "resolution_note", type: "varchar", length: 500, nullable: true })
	resolutionNote!: string | null;

	@Column({ name: "received_at", type: "timestamptz" })
	receivedAt!: Date;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt!: Date;
}
