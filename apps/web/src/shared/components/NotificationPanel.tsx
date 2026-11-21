import { Bell, CheckCheck } from "lucide-react";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { NotificationList } from "./NotificationList";
import { NotificationPanelControls } from "./NotificationPanelControls";
import { toast } from "./Toast";
import type { NotificationItem, NotificationPanelProps } from "./notification-panel.types";
import { useNotificationPopover } from "./useNotificationPopover";
export type { NotificationItem } from "./notification-panel.types";

export function NotificationPanel({
	items,
	loading,
	error,
	onRefresh,
	onRead,
	label = "Thông báo",
	unreadCount,
	unreadCountStale = false,
	onOpenChange,
	onUnreadChange,
	groups,
	activeGroup,
	onGroupChange,
	hasMore,
	loadingMore,
	onLoadMore,
	refreshing,
}: NotificationPanelProps) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const [onlyUnread, setOnlyUnread] = useState(false);
	const [reading, setReading] = useState(false);
	const toggle = (next: boolean) => {
		setOpen(next);
		onOpenChange?.(next);
	};
	const { trigger, panel } = useNotificationPopover(open, () => toggle(false));
	const unread = items.filter((item) => item.unread);
	const count = unreadCount === undefined ? unread.length : unreadCount;
	const badge = count !== null && count > 99 ? "99+" : count;
	const visible = [...(onlyUnread ? unread : items)].sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
	);
	const read = (item: NotificationItem) => {
		void onRead(item).catch(() =>
			toast.error("Chưa đánh dấu đã đọc. Thông báo vẫn được giữ là chưa đọc.")
		);
	};
	const markLoaded = async () => {
		setReading(true);
		const results = await Promise.allSettled(unread.map(onRead));
		if (results.some((result) => result.status === "rejected"))
			toast.error("Chưa đánh dấu được một số thông báo. Vui lòng thử lại.");
		setReading(false);
	};
	return (
		<>
			<button
				ref={trigger}
				type="button"
				aria-label={
					count === null
						? `${label} (chưa tải được số chưa đọc)`
						: `${label} (${count} chưa đọc)${unreadCountStale ? " · số gần nhất, chưa cập nhật được" : ""}`
				}
				title="Thông báo"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				className="relative shrink-0 rounded-full p-2 text-brand-primary hover:bg-brand-light focus-visible:ring-2 focus-visible:ring-brand-primary"
				onClick={() => {
					if (!open) onRefresh();
					toggle(!open);
				}}
			>
				<Bell aria-hidden="true" className="size-5" />
				{unreadCountStale && (
					<span
						aria-hidden="true"
						className="absolute -bottom-1 right-0 rounded-full bg-amber-100 px-1 text-xs font-bold text-amber-900"
					>
						!
					</span>
				)}
				{count !== null && count > 0 && (
					<span
						aria-hidden="true"
						className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
					>
						{badge}
					</span>
				)}
			</button>
			{open &&
				createPortal(
					<dialog
						ref={panel}
						id={id}
						open
						aria-label="Thông báo"
						className="fixed z-[100] m-0 flex flex-col overflow-hidden rounded-2xl border border-[#dfe8df] bg-white text-brand-dark shadow-xl"
					>
						<NotificationPanelControls
							groups={groups}
							activeGroup={activeGroup}
							onGroupChange={onGroupChange}
							onRefresh={onRefresh}
							refreshing={refreshing}
							onlyUnread={onlyUnread}
							onUnreadChange={(value) => {
								setOnlyUnread(value);
								onUnreadChange?.(value);
							}}
							onClose={() => {
								toggle(false);
								trigger.current?.focus();
							}}
						/>
						<NotificationList
							items={visible}
							feedKey={`${activeGroup ?? "default"}:${onlyUnread}`}
							loading={loading}
							error={error}
							onRefresh={onRefresh}
							onRead={read}
							onNavigate={() => toggle(false)}
							hasMore={hasMore}
							loadingMore={loadingMore}
							onLoadMore={onLoadMore}
							onlyUnread={onlyUnread}
						/>
						<div className="flex shrink-0 justify-end border-t border-[#dfe8df] px-3 py-2">
							<Button
								size="sm"
								variant="ghost"
								disabled={unread.length === 0 || reading}
								onClick={() => void markLoaded()}
							>
								<CheckCheck aria-hidden="true" className="mr-1 size-4" />
								{reading
									? "Đang đánh dấu…"
									: groups
										? "Đọc các mục đã tải"
										: "Đánh dấu đã đọc tất cả"}
							</Button>
						</div>
					</dialog>,
					trigger.current?.closest("[data-sidebar-drawer]") ?? document.body
				)}
		</>
	);
}
