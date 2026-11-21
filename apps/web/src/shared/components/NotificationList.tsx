import { Bell } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { Button } from "./Button";
import { NotificationRow } from "./NotificationRow";
import type { NotificationItem } from "./notification-panel.types";

interface Props {
	items: NotificationItem[];
	feedKey: string;
	loading: boolean;
	error?: string;
	onRefresh: () => void;
	onRead: (item: NotificationItem) => void;
	onNavigate: () => void;
	onLoadMore?: () => void;
	hasMore?: boolean;
	loadingMore?: boolean;
	onlyUnread: boolean;
}
export function NotificationList({
	items,
	feedKey,
	loading,
	error,
	onRefresh,
	onRead,
	onNavigate,
	onLoadMore,
	hasMore,
	loadingMore,
	onlyUnread,
}: Props) {
	const body = useRef<HTMLDivElement>(null);
	const anchor = useRef<{ id: string; offset: number } | null>(null);
	const previousFeed = useRef(feedKey);
	const recordAnchor = useCallback(() => {
		const root = body.current;
		if (!root || root.scrollTop === 0) {
			anchor.current = null;
			return;
		}
		const top = root.getBoundingClientRect().top;
		const first = [...root.querySelectorAll<HTMLElement>("[data-notification-id]")].find(
			(row) => row.getBoundingClientRect().bottom > top
		);
		anchor.current = first
			? { id: first.dataset.notificationId ?? "", offset: first.getBoundingClientRect().top - top }
			: null;
	}, []);
	useLayoutEffect(() => {
		if (items.length === 0) anchor.current = null;
		const root = body.current;
		if (!root) return;
		if (previousFeed.current !== feedKey) {
			root.scrollTop = 0;
			anchor.current = null;
			previousFeed.current = feedKey;
		}
		if (anchor.current) {
			const row = [...root.querySelectorAll<HTMLElement>("[data-notification-id]")].find(
				(entry) => entry.dataset.notificationId === anchor.current?.id
			);
			if (row)
				root.scrollTop +=
					row.getBoundingClientRect().top -
					root.getBoundingClientRect().top -
					anchor.current.offset;
		}
		recordAnchor();
	}, [items, feedKey, recordAnchor]);
	return (
		<div
			ref={body}
			onScroll={recordAnchor}
			className="min-h-0 max-h-[min(480px,60vh)] overflow-y-auto overscroll-contain"
			aria-live="polite"
		>
			{error && (
				<div role="alert" className="px-4 py-3 text-sm text-red-700">
					{error}
					<Button size="sm" variant="ghost" onClick={onRefresh}>
						Thử lại
					</Button>
				</div>
			)}
			{loading && <p className="px-4 py-6 text-sm text-[#627769]">Đang tải thông báo…</p>}
			{!loading && !error && items.length === 0 && (
				<div className="px-4 py-10 text-center text-sm text-[#627769]">
					<Bell aria-hidden="true" className="mx-auto mb-3 size-7 text-[#8fa096]" />
					{onlyUnread ? "Bạn đã đọc hết thông báo." : "Bạn chưa có thông báo mới."}
				</div>
			)}
			<ul className="divide-y divide-[#edf2ee]">
				{items.map((item) => (
					<NotificationRow key={item.id} item={item} onRead={onRead} onNavigate={onNavigate} />
				))}
			</ul>
			{hasMore && (
				<div className="border-t px-4 py-3">
					<Button
						className="w-full"
						variant="secondary"
						onClick={onLoadMore}
						disabled={loadingMore}
					>
						{loadingMore ? "Đang tải thêm…" : "Tải thêm"}
					</Button>
				</div>
			)}
		</div>
	);
}
