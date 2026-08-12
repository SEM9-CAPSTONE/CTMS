import { FileClock, Flag, Home, LayoutDashboard, ShieldCheck, Users, X } from "lucide-react";

export type AdminNavigationItem = "dashboard" | "user-accounts" | "audit-logs" | "content-reports";

interface AdminSidebarProps {
	activeItem: AdminNavigationItem;
	onBackHome?: () => void;
	onClose?: () => void;
	className?: string;
}

const navigationItems = [
	{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, available: false },
	{ key: "user-accounts", label: "User Accounts", icon: Users, available: true },
	{ key: "audit-logs", label: "Audit Logs", icon: FileClock, available: false },
	{ key: "content-reports", label: "Content Reports", icon: Flag, available: false },
] as const;

export function AdminSidebar({
	activeItem,
	onBackHome,
	onClose,
	className = "",
}: AdminSidebarProps) {
	return (
		<aside className={`flex h-full w-72 flex-col border-r border-[#dfe8df] bg-white ${className}`}>
			<div className="flex items-center gap-3 border-b border-[#e7eee7] px-5 py-5">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#164027] text-white shadow-sm">
					<ShieldCheck className="size-6" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-base font-extrabold text-[#10221b]">CTMS Administration</p>
					<p className="text-xs font-medium text-[#667a6d]">Administration workspace</p>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Close administration menu"
						className="rounded-lg p-2 text-[#667a6d] transition hover:bg-[#f1f5f0] hover:text-[#164027] lg:hidden"
					>
						<X className="size-5" />
					</button>
				)}
			</div>

			<nav aria-label="Administration navigation" className="flex-1 space-y-1.5 px-4 py-5">
				{navigationItems.map((item) => {
					const Icon = item.icon;
					const isActive = activeItem === item.key;

					return (
						<button
							key={item.key}
							type="button"
							disabled={!item.available}
							aria-current={isActive ? "page" : undefined}
							className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold transition ${
								isActive
									? "bg-[#e8f0e6] text-[#164027] shadow-sm"
									: item.available
										? "text-[#425048] hover:bg-[#f1f5f0] hover:text-[#164027]"
										: "cursor-not-allowed text-[#98a69d]"
							}`}
						>
							<Icon className="size-5 shrink-0" />
							<span className="flex-1">{item.label}</span>
							{!item.available && (
								<span className="rounded-full bg-[#f1f5f0] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#7d8d83]">
									Coming soon
								</span>
							)}
						</button>
					);
				})}
			</nav>

			<div className="border-t border-[#e7eee7] p-4">
				<button
					type="button"
					onClick={onBackHome}
					disabled={!onBackHome}
					className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold text-[#425048] transition hover:bg-[#f1f5f0] hover:text-[#164027] disabled:cursor-default disabled:opacity-60"
				>
					<Home className="size-5" />
					<span>Back to Home</span>
				</button>
			</div>
		</aside>
	);
}
