import { RefreshCw, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { NotificationPanelProps } from "./notification-panel.types";

interface Props
	extends Pick<
		NotificationPanelProps,
		"groups" | "activeGroup" | "onGroupChange" | "onRefresh" | "refreshing"
	> {
	onClose: () => void;
	onUnreadChange: (unread: boolean) => void;
	onlyUnread: boolean;
}

function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
	if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
	const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
	const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
	let next = (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
	if (event.key === "Home") next = 0;
	if (event.key === "End") next = tabs.length - 1;
	event.preventDefault();
	tabs[next]?.focus();
	tabs[next]?.click();
}

export function NotificationPanelControls({
	onClose,
	groups,
	activeGroup,
	onGroupChange,
	onRefresh,
	refreshing,
	onlyUnread,
	onUnreadChange,
}: Props) {
	return (
		<>
			<div className="flex items-center justify-between gap-2 px-4 pt-4">
				<h2 className="text-base font-bold">Thông báo</h2>
				<div className="flex items-center gap-1">
					<button
						type="button"
						aria-label="Làm mới thông báo"
						disabled={refreshing}
						onClick={onRefresh}
						className="rounded-lg p-2 hover:bg-brand-light"
					>
						<RefreshCw
							aria-hidden="true"
							className={`size-4 ${refreshing ? "animate-spin" : ""}`}
						/>
					</button>
					<button
						type="button"
						aria-label="Đóng thông báo"
						className="rounded-lg p-2 hover:bg-brand-light"
						onClick={onClose}
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				</div>
			</div>
			{groups && (
				<div
					role="tablist"
					aria-label="Nhóm thông báo"
					onKeyDown={tabKeys}
					className="mx-4 mt-3 flex rounded-xl bg-[#edf3ee] p-1"
				>
					{groups.map((group) => (
						<button
							key={group.id}
							type="button"
							role="tab"
							aria-selected={activeGroup === group.id}
							tabIndex={activeGroup === group.id ? 0 : -1}
							onClick={() => onGroupChange?.(group.id)}
							className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeGroup === group.id ? "bg-white text-brand-primary shadow-sm" : "text-[#627769]"}`}
						>
							{group.label}
						</button>
					))}
				</div>
			)}
			<div
				role="tablist"
				aria-label="Lọc thông báo"
				onKeyDown={tabKeys}
				className="mt-2 flex border-b border-[#dfe8df] px-4"
			>
				{[false, true].map((value) => (
					<button
						key={String(value)}
						type="button"
						role="tab"
						aria-selected={onlyUnread === value}
						tabIndex={onlyUnread === value ? 0 : -1}
						onClick={() => onUnreadChange(value)}
						className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${onlyUnread === value ? "border-brand-primary text-brand-primary" : "border-transparent text-[#667a6d]"}`}
					>
						{value ? "Chưa đọc" : "Tất cả"}
					</button>
				))}
			</div>
		</>
	);
}
