export type NotificationEventType =
	| "trip.review.requested"
	| "trip.review.reminder"
	| "trip.review.auto_rejected";

export interface InAppNotification {
	id: string;
	eventType: NotificationEventType;
	occurredAt: string;
	createdAt: string;
	readAt: string | null;
	targetAvailable: boolean;
	target: { type: "trip"; tripId: string; title: string; action: "review" | "view" } | null;
}

export interface NotificationPage {
	items: InAppNotification[];
	nextCursor: string | null;
}

export type ReturnTypeOfNotificationTarget = ReturnType<
	typeof import("./hooks/useNotificationReviewTarget").useNotificationReviewTarget
>;
