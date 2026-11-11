import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum BookingExpiryOutboxEventType {
	BOOKING_EXPIRED = "booking.expired",
}

export interface BookingExpiredOutboxPayload {
	bookingId: string;
	recipientId: string;
	tripId: string;
	expiredAt: string;
	holdExpiresAt: string;
}

@Entity({ name: "booking_expiry_outbox_events" })
export class BookingExpiryOutboxEvent {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "event_type", type: "varchar", length: 80 })
	eventType!: BookingExpiryOutboxEventType;

	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;

	@Column({ name: "recipient_id", type: "uuid" })
	recipientId!: string;

	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;

	@Column({ type: "jsonb" })
	payload!: BookingExpiredOutboxPayload;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
