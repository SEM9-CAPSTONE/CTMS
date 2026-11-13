import { ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { HomeLink } from "./HomeLink";
import { SidebarPopover } from "./SidebarPopover";

export interface SidebarControls {
	collapsed: boolean;
	onToggle: () => void;
	onClose?: () => void;
}

interface SidebarAccount {
	name: string;
	label: string;
	roleLabel: string;
	avatarUrl?: string;
	email?: string;
	renderActions?: (close: () => void) => ReactNode;
}

interface SidebarFrameProps extends Partial<SidebarControls> {
	title: string;
	children: ReactNode;
	account: SidebarAccount;
	notices?: ReactNode;
}

function SidebarAccountMenu({
	account,
	collapsed,
}: { account: SidebarAccount; collapsed: boolean }) {
	const menuId = useId();
	const [anchor, setAnchor] = useState<HTMLButtonElement>();
	const [failedAvatarUrl, setFailedAvatarUrl] = useState<string>();
	const { name, label, roleLabel, avatarUrl, email, renderActions } = account;
	const closeMenu = () => setAnchor(undefined);

	return (
		<>
			<button
				type="button"
				aria-label={label}
				title={collapsed ? name : undefined}
				aria-expanded={Boolean(anchor)}
				aria-controls={anchor ? menuId : undefined}
				onClick={(event) => setAnchor(anchor ? undefined : event.currentTarget)}
				className={`sidebar-profile-row ${collapsed ? "justify-center" : ""}`}
			>
				{avatarUrl && avatarUrl !== failedAvatarUrl ? (
					<img
						src={avatarUrl}
						alt=""
						onError={() => setFailedAvatarUrl(avatarUrl)}
						className="size-8 shrink-0 rounded-full object-cover"
					/>
				) : (
					<CircleUserRound aria-hidden="true" className="size-8 shrink-0 text-[#48765a]" />
				)}
				{!collapsed && (
					<>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="sidebar-profile-name">{name}</span>
							<span className="sidebar-profile-meta">{roleLabel}</span>
						</span>
						<ChevronDown aria-hidden="true" className="size-4 shrink-0" />
					</>
				)}
			</button>
			{anchor && (
				<SidebarPopover
					anchor={anchor}
					id={menuId}
					placement={collapsed ? "right" : "above"}
					onClose={closeMenu}
				>
					<div className="px-2.5 py-2">
						<p className="truncate text-sm font-semibold text-brand-primary">{name}</p>
						{email && <p className="break-all text-xs text-[#496454]">{email}</p>}
					</div>
					{renderActions?.(closeMenu)}
				</SidebarPopover>
			)}
		</>
	);
}

export function SidebarFrame({
	title,
	collapsed = false,
	onToggle,
	onClose,
	account,
	notices,
	children,
}: SidebarFrameProps) {
	const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;
	const toggleLabel = collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng";

	return (
		<aside
			className={`sidebar-surface ${collapsed ? "w-[4.5rem]" : "w-72 max-w-[calc(100vw-2.5rem)]"}`}
		>
			<div className={`sidebar-header ${collapsed ? "justify-center px-2" : ""}`}>
				<HomeLink className={`sidebar-brand ${collapsed ? "justify-center" : "flex-1"}`}>
					<img src="/ctms_logo.png" alt="" className="size-9 shrink-0 scale-150 object-contain" />
					{!collapsed && <span className="sidebar-brand-title">{title}</span>}
				</HomeLink>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng menu"
						className="rounded-lg p-2 text-brand-primary hover:bg-brand-light lg:hidden"
					>
						<X aria-hidden="true" className="size-5" />
					</button>
				)}
			</div>
			{onToggle && (
				<button
					type="button"
					aria-label={toggleLabel}
					aria-expanded={!collapsed}
					title={toggleLabel}
					onClick={onToggle}
					className="sidebar-edge-toggle right-0 hidden translate-x-1/2 lg:grid"
				>
					<ToggleIcon aria-hidden="true" className="size-3.5" />
				</button>
			)}
			{children}
			<div className={`sidebar-footer ${collapsed ? "p-2" : ""}`}>
				{notices && (
					<div className={`flex items-center ${collapsed ? "flex-col" : "justify-end"}`}>
						{notices}
					</div>
				)}
				<SidebarAccountMenu key={String(collapsed)} account={account} collapsed={collapsed} />
			</div>
		</aside>
	);
}
