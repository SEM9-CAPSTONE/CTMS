import { HttpError } from "../../../core/api";
import type { NotificationItem } from "../../../shared/components/NotificationPanel";
import { NOTIFICATION_EVENTS } from "../constants";
import type { InAppNotification } from "../types";

const EVENT_LABELS = {
	[NOTIFICATION_EVENTS.REQUESTED]: "Chuyến đi mới cần xét duyệt",
	[NOTIFICATION_EVENTS.REMINDER]: "Chuyến đi sắp hết hạn xét duyệt",
	[NOTIFICATION_EVENTS.AUTO_REJECTED]: "Chuyến đi đã bị từ chối tự động",
} as const;

export function notificationItem(notice: InAppNotification): NotificationItem {
	const target = notice.targetAvailable ? notice.target : null;
	const href =
		target &&
		(target.action === "review"
			? `/admin/trips?tripId=${encodeURIComponent(target.tripId)}`
			: `/trips/${encodeURIComponent(target.tripId)}?from=notification`);
	return {
		id: `in-app:${notice.id}`,
		tripId: target?.tripId ?? null,
		title: EVENT_LABELS[notice.eventType] ?? "Cập nhật chuyến đi",
		description: target?.title ?? "Nội dung không còn khả dụng hoặc bạn không còn quyền truy cập.",
		createdAt: notice.createdAt,
		unread: notice.readAt === null,
		kind: "review",
		href: href || null,
	};
}

export function notificationError(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403) return "Bạn không có quyền xem nội dung này.";
		if (error.status === 404)
			return "Nội dung không còn khả dụng hoặc bạn không còn quyền truy cập.";
	}
	return "Chưa tải được thông báo. Vui lòng thử lại.";
}
