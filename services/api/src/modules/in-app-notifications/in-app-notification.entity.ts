import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum InAppNotificationType {
	REVIEW_REQUESTED = "trip.review.requested",
	REVIEW_REMINDER = "trip.review.reminder",
	AUTO_REJECTED = "trip.review.auto_rejected",
}

@Entity("in_app_notifications")
export class InAppNotification {
	@PrimaryGeneratedColumn("uuid") id!: string;
	@Column({ name: "recipient_id", type: "uuid" }) recipientId!: string;
	@Column({ name: "trip_id", type: "uuid", nullable: true }) tripId!: string | null;
	@Column({ name: "event_type", type: "varchar", length: 50 }) eventType!: InAppNotificationType;
	@Column({ name: "source_key", type: "varchar", length: 250 }) sourceKey!: string;
	@Column({ name: "occurred_at", type: "timestamptz" }) occurredAt!: Date;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
	@Column({ name: "read_at", type: "timestamptz", nullable: true }) readAt!: Date | null;
	@Column({ name: "delivered_at", type: "timestamptz", nullable: true }) deliveredAt!: Date | null;
}
