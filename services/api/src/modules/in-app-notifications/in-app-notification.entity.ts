import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum InAppNotificationType {
	REVIEW_REQUESTED = "trip.review.requested",
	REVIEW_REMINDER = "trip.review.reminder",
	AUTO_REJECTED = "trip.review.auto_rejected",
	REVIEW_MODERATION_FLAGGED = "trip.review.moderation_flagged",
	REVIEW_AUTO_HIDDEN = "trip.review.auto_hidden",
	REVIEW_MODERATION_UNVERIFIED = "trip.review.moderation_unverified",
	REVIEW_MODERATION_REMINDER = "trip.review.moderation_reminder",
	REVIEW_MODERATION_ESCALATED = "trip.review.moderation_escalated",
	TREKKING_ROUTE_APPROVED = "trekking_route.approved",
}

@Entity("in_app_notifications")
export class InAppNotification {
	@PrimaryGeneratedColumn("uuid") id!: string;
	@Column({ name: "recipient_id", type: "uuid" }) recipientId!: string;
	@Column({ name: "trip_id", type: "uuid", nullable: true }) tripId!: string | null;
	@Column({ name: "review_id", type: "uuid", nullable: true }) reviewId!: string | null;
	@Column({ name: "trekking_route_id", type: "uuid", nullable: true }) trekkingRouteId!:
		| string
		| null;
	@Column({ name: "event_type", type: "varchar", length: 50 }) eventType!: InAppNotificationType;
	@Column({ name: "source_key", type: "varchar", length: 250 }) sourceKey!: string;
	@Column({ name: "occurred_at", type: "timestamptz" }) occurredAt!: Date;
	@CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
	@Column({ name: "read_at", type: "timestamptz", nullable: true }) readAt!: Date | null;
	@Column({ name: "delivered_at", type: "timestamptz", nullable: true }) deliveredAt!: Date | null;
}
