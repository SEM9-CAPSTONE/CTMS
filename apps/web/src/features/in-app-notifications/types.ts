export type NotificationEventType =
	| "trip.review.requested"
	| "trip.review.reminder"
	| "trip.review.auto_rejected"
	| "trip.review.moderation_flagged"
	| "trip.review.auto_hidden"
	| "trip.review.moderation_unverified"
	| "trip.review.moderation_reminder"
	| "trip.review.moderation_escalated";

export type NotificationTarget =
	| { type: "trip"; tripId: string; title: string; action: "review" | "view" }
	| {
			type: "trip_review";
			tripId: string;
			reviewId: string;
			title: string;
			action: "moderate";
	  }
	| {
			type: "admin_content_reports";
			tripId: string;
			reviewId: string;
			title: string;
			action: "review";
	  };

export interface InAppNotification {
	id: string;
	eventType: NotificationEventType;
	occurredAt: string;
	createdAt: string;
	readAt: string | null;
	targetAvailable: boolean;
	target: NotificationTarget | null;
}

export interface NotificationPage {
	items: InAppNotification[];
	nextCursor: string | null;
}

export type ReturnTypeOfNotificationTarget = ReturnType<
	typeof import("./hooks/useNotificationReviewTarget").useNotificationReviewTarget
>;
