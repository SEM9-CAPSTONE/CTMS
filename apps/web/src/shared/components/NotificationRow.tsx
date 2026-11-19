import {
	ArrowRight,
	CalendarClock,
	Check,
	ClipboardCheck,
	LockKeyhole,
	ShieldCheck,
	TicketX,
} from "lucide-react";
import { guardedNavigation } from "../../core/navigation-guard";
import type { NotificationItem } from "./notification-panel.types";

interface Props {
	item: NotificationItem;
	onRead: (item: NotificationItem) => void;
	onNavigate: () => void;
}

export function NotificationRow({ item, onRead, onNavigate }: Props) {
	const href = item.href === undefined ? (item.tripId ? `/trips/${item.tripId}` : null) : item.href;
	const icons = {
		departure: CalendarClock,
		booking: TicketX,
		review: ClipboardCheck,
		level: ShieldCheck,
		trip: CalendarClock,
	};
	const Icon = href ? icons[item.kind] : LockKeyhole;
	const content = (
		<>
			<Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-primary" />
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-3">
					<h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
					{item.unread && (
						<span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
							Chưa đọc
						</span>
					)}
				</div>
				<p className="mt-1 text-sm leading-relaxed text-[#53685a]">{item.description}</p>
				{href && (
					<span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary">
						Xem chuyến <ArrowRight aria-hidden="true" className="size-3.5" />
					</span>
				)}
				{!href && (
					<p className="mt-1 text-xs font-medium text-slate-600">Không thể mở nội dung này</p>
				)}
				<time dateTime={item.createdAt} className="mt-2 block text-xs text-[#667a6d]">
					Nhận lúc{" "}
					{new Date(item.createdAt).toLocaleString("vi-VN", {
						timeZone: "Asia/Ho_Chi_Minh",
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
					})}
				</time>
			</div>
		</>
	);
	const className = `flex gap-3 px-4 py-4 ${item.unread ? "bg-[#f5faf6]" : ""}`;
	return (
		<li data-notification-id={item.id}>
			{href ? (
				<a
					href={href}
					className={`${className} transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-brand-primary`}
					onClick={(event) => {
						if (item.unread) onRead(item);
						if (
							event.button === 0 &&
							!event.ctrlKey &&
							!event.metaKey &&
							!event.shiftKey &&
							!event.altKey
						) {
							event.preventDefault();
							guardedNavigation(() => {
								onNavigate();
								window.history.pushState({}, "", href);
								window.dispatchEvent(new PopStateEvent("popstate"));
							});
						}
					}}
				>
					{content}
				</a>
			) : (
				<div className={className}>{content}</div>
			)}
			{item.unread && (
				<button
					type="button"
					onClick={() => onRead(item)}
					className="mb-3 ml-12 inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-light"
				>
					<Check className="size-3" aria-hidden="true" />
					Đánh dấu đã đọc
				</button>
			)}
		</li>
	);
}
