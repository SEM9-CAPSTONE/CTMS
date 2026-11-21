export interface NotificationItem {
	id: string;
	tripId: string | null;
	title: string;
	description: string;
	createdAt: string;
	unread: boolean;
	kind: "departure" | "booking" | "review" | "level" | "trip";
	/** null deliberately disables navigation when the backend redacts a target. */
	href?: string | null;
}

export interface NotificationPanelProps {
	items: NotificationItem[];
	loading: boolean;
	error?: string;
	onRefresh: () => void;
	onRead: (item: NotificationItem) => Promise<unknown>;
	label?: string;
	unreadCount?: number | null;
	unreadCountStale?: boolean;
	onOpenChange?: (open: boolean) => void;
	onUnreadChange?: (unread: boolean) => void;
	groups?: readonly { id: string; label: string }[];
	activeGroup?: string;
	onGroupChange?: (id: string) => void;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
	refreshing?: boolean;
}
