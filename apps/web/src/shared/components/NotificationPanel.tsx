import { Bell, CalendarClock, CheckCheck, TicketX, X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guardedNavigation } from "../../core/navigation-guard";
import { Button } from "./Button";

export interface NotificationItem {
	id: string;
	tripId: string;
	title: string;
	description: string;
	createdAt: string;
	unread: boolean;
	kind: "departure" | "booking";
}
interface Props {
	items: NotificationItem[];
	loading: boolean;
	error?: string;
	onRefresh: () => void;
	onRead: (item: NotificationItem) => Promise<unknown>;
	label?: string;
}
const sentTime = (value: string) => {
	const parts = new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(value));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((entry) => entry.type === type)?.value ?? "";
	return `${part("hour")}:${part("minute")} · ${part("day")}/${part("month")}`;
};

export function NotificationPanel({
	items,
	loading,
	error,
	onRefresh,
	onRead,
	label = "Thông báo",
}: Props) {
	const id = useId();
	const trigger = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLDialogElement>(null);
	const [open, setOpen] = useState(false);
	const [onlyUnread, setOnlyUnread] = useState(false);
	const [reading, setReading] = useState(false);
	const [readError, setReadError] = useState(false);
	const unread = items.filter((item) => item.unread);
	const visible = [...(onlyUnread ? unread : items)].sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
	);
	useLayoutEffect(() => {
		if (!open || !panel.current || !trigger.current) return;
		const element = panel.current;
		const position = () => {
			const bounds = trigger.current?.getBoundingClientRect();
			if (!bounds) return;
			const width = Math.min(432, window.innerWidth - 24);
			element.style.width = `${width}px`;
			element.style.left = `${Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))}px`;
			element.style.top = `${Math.min(bounds.bottom + 8, window.innerHeight - 180)}px`;
			element.style.maxHeight = `${Math.max(160, window.innerHeight - bounds.bottom - 20)}px`;
		};
		const outside = (event: Event) => {
			if (
				event.target instanceof Node &&
				!element.contains(event.target) &&
				!trigger.current?.contains(event.target)
			)
				setOpen(false);
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				trigger.current?.focus();
			}
		};
		position();
		element.querySelector<HTMLButtonElement>('button[aria-label="Đóng thông báo"]')?.focus();
		document.addEventListener("pointerdown", outside);
		document.addEventListener("focusin", outside);
		document.addEventListener("keydown", onEscape);
		window.addEventListener("resize", position);
		return () => {
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("focusin", outside);
			document.removeEventListener("keydown", onEscape);
			window.removeEventListener("resize", position);
		};
	}, [open]);
	const markAll = async () => {
		setReading(true);
		setReadError(false);
		const results = await Promise.allSettled(unread.map(onRead));
		setReadError(results.some((result) => result.status === "rejected"));
		setReading(false);
	};
	return (
		<>
			<button
				ref={trigger}
				type="button"
				aria-label={`${label} (${unread.length} chưa đọc)`}
				title="Thông báo"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				className="relative shrink-0 rounded-full p-2 text-brand-primary hover:bg-brand-light focus-visible:ring-2 focus-visible:ring-brand-primary"
				onClick={() => {
					if (!open) onRefresh();
					setOpen(!open);
				}}
			>
				<Bell aria-hidden="true" className="size-5" />
				{unread.length > 0 && (
					<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
						{unread.length}
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
						className="fixed z-50 m-0 flex flex-col overflow-hidden rounded-2xl border border-[#dfe8df] bg-white text-brand-dark shadow-xl"
					>
						<div className="flex items-center justify-between gap-2 px-4 pt-4">
							<h2 className="flex items-center gap-2 text-base font-bold">
								Thông báo
								{unread.length > 0 && (
									<span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-primary">
										{unread.length}
									</span>
								)}
							</h2>
							<Button
								size="sm"
								variant="ghost"
								disabled={unread.length === 0 || reading}
								onClick={() => void markAll()}
							>
								<CheckCheck aria-hidden="true" className="mr-1 size-4" />
								{reading ? "Đang đánh dấu…" : "Đánh dấu đã đọc tất cả"}
							</Button>
							<button
								type="button"
								aria-label="Đóng thông báo"
								className="rounded-lg p-1.5 hover:bg-brand-light"
								onClick={() => {
									setOpen(false);
									trigger.current?.focus();
								}}
							>
								<X aria-hidden="true" className="size-4" />
							</button>
						</div>
						<div
							role="tablist"
							aria-label="Lọc thông báo"
							className="mt-2 flex border-b border-[#dfe8df] px-4"
						>
							{[false, true].map((value) => (
								<button
									key={String(value)}
									type="button"
									role="tab"
									aria-selected={onlyUnread === value}
									className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${onlyUnread === value ? "border-brand-primary text-brand-primary" : "border-transparent text-[#667a6d]"}`}
									onClick={() => setOnlyUnread(value)}
								>
									{value ? "Chưa đọc" : "Tất cả"}
								</button>
							))}
						</div>
						<div className="min-h-0 overflow-y-auto" aria-live="polite">
							{(error || readError) && (
								<div role="alert" className="px-4 py-3 text-sm text-red-700">
									{readError ? "Chưa đánh dấu được một số thông báo. Thử lại nhé." : error}
									<Button size="sm" variant="ghost" onClick={onRefresh}>
										Thử lại
									</Button>
								</div>
							)}
							{loading && <p className="px-4 py-6 text-sm text-[#627769]">Đang tải thông báo…</p>}
							{!loading && !error && visible.length === 0 && (
								<div className="px-4 py-10 text-center text-sm text-[#627769]">
									<Bell aria-hidden="true" className="mx-auto mb-3 size-7 text-[#8fa096]" />
									{onlyUnread ? "Bạn đã đọc hết thông báo." : "Bạn chưa có thông báo mới."}
								</div>
							)}
							<ul className="divide-y divide-[#edf2ee]">
								{visible.map((item) => {
									const Icon = item.kind === "departure" ? CalendarClock : TicketX;
									return (
										<li key={item.id}>
											<a
												href={`/trips/${item.tripId}`}
												className={`flex gap-3 px-4 py-4 transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-brand-primary ${item.unread ? "bg-[#f5faf6]" : ""}`}
												onClick={(event) => {
													if (item.unread) void onRead(item).catch(() => setReadError(true));
													if (
														event.button === 0 &&
														!event.ctrlKey &&
														!event.metaKey &&
														!event.shiftKey &&
														!event.altKey
													) {
														event.preventDefault();
														guardedNavigation(() => {
															setOpen(false);
															window.history.pushState({}, "", `/trips/${item.tripId}`);
															window.dispatchEvent(new PopStateEvent("popstate"));
														});
													}
												}}
											>
												<Icon
													aria-hidden="true"
													className="mt-0.5 size-5 shrink-0 text-brand-primary"
												/>
												<div className="min-w-0 flex-1">
													<div className="flex items-start justify-between gap-3">
														<h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
														{item.unread && (
															<span
																aria-label="Chưa đọc"
																className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600"
															/>
														)}
													</div>
													<p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#53685a]">
														{item.description}
													</p>
													<time
														dateTime={item.createdAt}
														className="mt-2 block text-right text-xs text-[#667a6d]"
													>
														Nhận lúc {sentTime(item.createdAt)}
													</time>
												</div>
											</a>
										</li>
									);
								})}
							</ul>
						</div>
					</dialog>,
					trigger.current?.closest("[data-sidebar-drawer]") ?? document.body
				)}
		</>
	);
}
