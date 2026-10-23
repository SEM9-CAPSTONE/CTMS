import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

/** A transactional inbox: recipients see rows only after cancellation commits. */
@Entity({ name: "booking_cancellation_notices" })
@Unique("UQ_booking_cancellation_notice_recipient", ["bookingId", "recipientId"])
export class BookingCancellationNotice {
	@PrimaryGeneratedColumn("uuid")
	id!: string;
	@Column({ name: "recipient_id", type: "uuid" })
	recipientId!: string;
	@Column({ name: "booking_id", type: "uuid" })
	bookingId!: string;
	@Column({ name: "trip_id", type: "uuid" })
	tripId!: string;
	@Column({ name: "trip_title", type: "varchar", length: 150 })
	tripTitle!: string;
	@Column({ name: "camper_name", type: "varchar", length: 50, nullable: true })
	camperName!: string | null;
	@Column({ type: "varchar", length: 255 })
	reason!: string;
	@Column({ name: "read_at", type: "timestamptz", nullable: true })
	readAt!: Date | null;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt!: Date;
}
