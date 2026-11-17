export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_POLL_MS = 30_000;
export const NOTIFICATION_EVENTS = {
	CREATED: "notification.created",
	REQUESTED: "trip.review.requested",
	REMINDER: "trip.review.reminder",
	AUTO_REJECTED: "trip.review.auto_rejected",
} as const;
export const NOTIFICATION_GROUPS = [
	{ id: "trips", label: "Chuyến đi" },
	{ id: "other", label: "Hoạt động khác" },
] as const;
