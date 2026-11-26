import { HttpError } from "../../../core/api";
import { RoutePath } from "../../../routes/routes.config";
import type { NotificationItem } from "../../../shared/components/NotificationPanel";
import { NOTIFICATION_EVENTS } from "../constants";
import type { InAppNotification } from "../types";

const EVENT_LABELS = {
	[NOTIFICATION_EVENTS.REQUESTED]: "Chuyến đi mới cần xét duyệt",
	[NOTIFICATION_EVENTS.REMINDER]: "Chuyến đi sắp hết hạn xét duyệt",
	[NOTIFICATION_EVENTS.AUTO_REJECTED]: "Chuyến đi đã bị từ chối tự động",
	[NOTIFICATION_EVENTS.REVIEW_MODERATION_FLAGGED]: "Đánh giá cần xem xét",
	[NOTIFICATION_EVENTS.REVIEW_AUTO_HIDDEN]: "Đánh giá đã tự động ẩn",
	[NOTIFICATION_EVENTS.REVIEW_MODERATION_UNVERIFIED]: "Đánh giá chưa xác minh được",
	[NOTIFICATION_EVENTS.REVIEW_MODERATION_REMINDER]: "Nhắc xem xét đánh giá quá hạn",
	[NOTIFICATION_EVENTS.REVIEW_MODERATION_ESCALATED]: "Đánh giá cần quản trị viên kiểm tra",
	[NOTIFICATION_EVENTS.TREKKING_ROUTE_APPROVED]: "Tuyến trekking đã được phê duyệt",
} as const;

export function notificationItem(notice: InAppNotification): NotificationItem {
	const target = notice.targetAvailable ? notice.target : null;
	let href: string | null = null;
	if (target) {
		if (target.type === "trip_review") {
			href = `/host/review-analysis?trip=${encodeURIComponent(target.tripId)}&reviewId=${encodeURIComponent(target.reviewId)}`;
		} else if (target.type === "admin_content_reports") {
			href = "/admin/content-reports";
		} else if (target.type === "trekking_route") {
			href = `${RoutePath.HOST_TREKKING_ROUTES}/${encodeURIComponent(target.routeId)}`;
		} else {
			href =
				target.action === "review"
					? `/admin/trips?tripId=${encodeURIComponent(target.tripId)}`
					: `/trips/${encodeURIComponent(target.tripId)}?from=notification`;
		}
	}
	return {
		id: `in-app:${notice.id}`,
		tripId: target && "tripId" in target ? target.tripId : null,
		title: EVENT_LABELS[notice.eventType] ?? "Cập nhật chuyến đi",
		description: target?.title ?? "Nội dung không còn khả dụng hoặc bạn không còn quyền truy cập.",
		createdAt: notice.createdAt,
		unread: notice.readAt === null,
		kind: "review",
		href,
		...(target?.type === "trekking_route" ? { actionLabel: "Xem tuyến đường" } : {}),
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
