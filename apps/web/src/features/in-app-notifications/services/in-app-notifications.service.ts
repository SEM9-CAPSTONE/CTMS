import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { NOTIFICATION_PAGE_SIZE } from "../constants";
import type { NotificationPage } from "../types";

export const inAppNotificationsService = {
	list: (unread: boolean, cursor?: string): Promise<NotificationPage> =>
		httpClient.get(API_ENDPOINTS.IN_APP_NOTIFICATIONS.LIST, {
			limit: NOTIFICATION_PAGE_SIZE,
			state: unread ? "unread" : undefined,
			cursor,
		}),
	count: (): Promise<{ unreadCount: number }> =>
		httpClient.get(API_ENDPOINTS.IN_APP_NOTIFICATIONS.COUNT),
	markRead: (id: string): Promise<void> =>
		httpClient.patch(API_ENDPOINTS.IN_APP_NOTIFICATIONS.READ(id)),
};
