import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum TripAutoCancelOutboxEventType {
	TRIP_AUTO_CANCELLED = "trip.auto_cancelled",
}

export interface TripAutoCancelledOutboxPayload {
	tripId: string;
	bookingId: string;
	recipientId: string;
	cancelledAt: string;
	confirmedParticipants: number;
	capacityMin: number;
}

/** CTMS-036. Mirrors `BookingExpiryOutboxEvent` exactly (same post-commit-notification
 *  pattern, BR-194/BR-195): one row per affected Booking so the same Camper is never
 *  notified twice for the same auto-cancellation. */
@Entity({ name: "trip_auto_cancel_outbox_events" })
export class TripAutoCancelOutboxEvent {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "event_type", type: "varchar", length: 80 })
	eventType!: TripAutoCancelOutboxEventType;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@Column({ name: "recipient_id", type: "uuid" })
	recipientId!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@Column({ type: "jsonb" })
	payload!: TripAutoCancelledOutboxPayload;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
