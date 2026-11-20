export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_POLL_MS = 30_000;
export const NOTIFICATION_EVENTS = {
	CREATED: "notification.created",
	REQUESTED: "trip.review.requested",
	REMINDER: "trip.review.reminder",
	AUTO_REJECTED: "trip.review.auto_rejected",
	REVIEW_MODERATION_FLAGGED: "trip.review.moderation_flagged",
	REVIEW_AUTO_HIDDEN: "trip.review.auto_hidden",
	REVIEW_MODERATION_UNVERIFIED: "trip.review.moderation_unverified",
	REVIEW_MODERATION_REMINDER: "trip.review.moderation_reminder",
	REVIEW_MODERATION_ESCALATED: "trip.review.moderation_escalated",
} as const;
export const NOTIFICATION_GROUPS = [
	{ id: "trips", label: "Chuyến đi" },
	{ id: "other", label: "Hoạt động khác" },
] as const;
