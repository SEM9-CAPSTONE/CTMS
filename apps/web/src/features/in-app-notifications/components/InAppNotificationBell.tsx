import { useState } from "react";
import { HttpError } from "../../../core/api";
import {
	type NotificationItem,
	NotificationPanel,
} from "../../../shared/components/NotificationPanel";
import { NOTIFICATION_GROUPS } from "../constants";
import { useInAppNotifications } from "../hooks/useInAppNotifications";
import { notificationError, notificationItem } from "../utils/notification-view";

interface Props {
	primaryGroupLabel?: string;
	legacyItems: NotificationItem[];
	legacyLoading: boolean;
	legacyError?: string;
	onLegacyRefresh: () => void;
	onLegacyRead: (item: NotificationItem) => Promise<unknown>;
}

export function InAppNotificationBell({
	primaryGroupLabel,
	legacyItems,
	legacyLoading,
	legacyError,
	onLegacyRefresh,
	onLegacyRead,
}: Props) {
	const [group, setGroup] = useState<string>(NOTIFICATION_GROUPS[0].id);
	const [unread, setUnread] = useState(false);
	const [open, setOpen] = useState(false);
	const trips = group === NOTIFICATION_GROUPS[0].id;
	const inbox = useInAppNotifications(unread, open && trips);
	const restricted =
		inbox.list.error instanceof HttpError && [401, 403].includes(inbox.list.error.status);
	const notices = restricted ? [] : inbox.items.map(notificationItem);
	const legacyUnread = legacyItems.filter((item) => item.unread).length;
	const count = inbox.count.data === undefined ? null : inbox.count.data.unreadCount + legacyUnread;
	const error = inbox.list.error ?? inbox.count.error;
	const groups = primaryGroupLabel
		? [{ ...NOTIFICATION_GROUPS[0], label: primaryGroupLabel }, NOTIFICATION_GROUPS[1]]
		: NOTIFICATION_GROUPS;
	return (
		<NotificationPanel
			items={trips ? notices : legacyItems}
			loading={trips ? inbox.list.isPending : legacyLoading}
			error={trips ? (error ? notificationError(error) : undefined) : legacyError}
			unreadCount={count}
			unreadCountStale={inbox.count.isError && inbox.count.data !== undefined}
			groups={groups}
			activeGroup={group}
			onGroupChange={setGroup}
			onUnreadChange={setUnread}
			onOpenChange={setOpen}
			onRefresh={() => {
				inbox.refresh();
				onLegacyRefresh();
			}}
			onRead={(item) =>
				item.kind === "review"
					? inbox.markRead(item.id.slice("in-app:".length))
					: onLegacyRead(item)
			}
			hasMore={trips && inbox.list.hasNextPage}
			loadingMore={inbox.list.isFetchingNextPage}
			refreshing={trips && inbox.list.isRefetching}
			onLoadMore={() => {
				void inbox.list.fetchNextPage();
			}}
		/>
	);
}
