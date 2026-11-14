import { ChevronDown } from "lucide-react";
import { type MouseEvent, useId, useState } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { SidebarPopover } from "../../../shared/components/SidebarPopover";
import {
	ADMIN_NAV_GROUPS,
	ADMIN_NAV_ITEMS,
	ADMIN_NAV_TOP_LEVEL,
	type AdminNavGroup,
	type AdminNavigationItem,
} from "../constants";
import type { AdminModerationCounts } from "../types";

function countLabel(label: string, count: number) {
	return count > 0 ? `${label} ${count} mục chờ xử lý` : undefined;
}

function CountBadge({ count, total = false }: { count: number; total?: boolean }) {
	if (count <= 0) return null;
	return (
		<span
			aria-hidden="true"
			className={`sidebar-count-badge ${total ? "bg-red-600 text-white" : "bg-[#e4ece6] text-[#294e37]"}`}
		>
			{count}
		</span>
	);
}

interface NavigationProps {
	activeItem: AdminNavigationItem;
	collapsed: boolean;
	counts?: AdminModerationCounts;
	onNavigate?: () => void;
}

interface NavLinkProps {
	itemKey: AdminNavigationItem;
	activeItem: AdminNavigationItem;
	counts?: AdminModerationCounts;
	iconOnly?: boolean;
	isChild?: boolean;
	onNavigate?: () => void;
}

function AdminNavLink({
	itemKey,
	activeItem,
	counts,
	iconOnly,
	isChild,
	onNavigate,
}: NavLinkProps) {
	const { icon: Icon, label, path, countKey } = ADMIN_NAV_ITEMS[itemKey];
	const count = countKey ? (counts?.[countKey] ?? 0) : 0;
	const isActive = activeItem === itemKey;

	const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		guardedNavigation(() => {
			onNavigate?.();
			if (window.location.pathname === path && !window.location.search) return;
			const state = itemKey === "dashboard" ? { activeRole: "admin" } : {};
			window.history.pushState(state, "", path);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
	};

	return (
		<a
			href={path}
			onClick={navigate}
			aria-current={isActive ? "page" : undefined}
			aria-label={countLabel(label, count)}
			title={iconOnly ? label : undefined}
			className="sidebar-nav-row"
			data-active={isActive}
			data-child={isChild}
			data-icon-only={iconOnly}
		>
			<Icon aria-hidden="true" className={isChild ? "size-4 shrink-0" : "size-5 shrink-0"} />
			<span className={iconOnly ? "sr-only" : "min-w-0 flex-1 leading-tight"}>{label}</span>
			<CountBadge count={count} />
		</a>
	);
}

export function AdminSidebarNavigation({
	activeItem,
	collapsed,
	counts,
	onNavigate,
}: NavigationProps) {
	const id = useId();
	const activeGroup = ADMIN_NAV_GROUPS.find((group) =>
		group.items.some((item) => item === activeItem)
	);
	const [groupOverrides, setGroupOverrides] = useState<
		Partial<Record<AdminNavGroup["key"], boolean>>
	>({});
	const [flyout, setFlyout] = useState<{ group: AdminNavGroup; anchor: HTMLElement }>();

	const renderLinks = (group: AdminNavGroup, closeFlyout?: () => void) =>
		group.items.map((key) => (
			<AdminNavLink
				key={key}
				itemKey={key}
				activeItem={activeItem}
				counts={counts}
				isChild
				onNavigate={() => {
					closeFlyout?.();
					onNavigate?.();
				}}
			/>
		));

	return (
		<nav aria-label="Điều hướng quản trị" className={`sidebar-menu ${collapsed ? "px-2" : ""}`}>
			{!collapsed && <p className="sidebar-nav-label">Menu chính</p>}
			{ADMIN_NAV_TOP_LEVEL.map((itemKey) => (
				<AdminNavLink
					key={itemKey}
					itemKey={itemKey}
					activeItem={activeItem}
					iconOnly={collapsed}
					onNavigate={onNavigate}
				/>
			))}
			{ADMIN_NAV_GROUPS.map((group) => {
				const Icon = group.icon;
				const selected = activeGroup?.key === group.key;
				const open = collapsed
					? flyout?.group.key === group.key
					: (groupOverrides[group.key] ?? selected);
				const groupId = `${id}-${group.key}`;
				const total = group.items.reduce((sum, key) => {
					const countKey = ADMIN_NAV_ITEMS[key].countKey;
					return sum + (countKey ? (counts?.[countKey] ?? 0) : 0);
				}, 0);
				return (
					<div
						key={group.key}
						className={group.key === "users" ? "mt-2 border-t border-[#e7eee7] pt-2" : undefined}
					>
						<button
							type="button"
							title={collapsed ? group.label : undefined}
							aria-label={countLabel(group.label, total)}
							aria-expanded={open}
							aria-controls={open ? groupId : undefined}
							onClick={(event) => {
								if (collapsed) {
									setFlyout(open ? undefined : { group, anchor: event.currentTarget });
									return;
								}
								setGroupOverrides((previous) => ({
									...previous,
									[group.key]: !(previous[group.key] ?? selected),
								}));
							}}
							className={collapsed && total > 0 ? "sidebar-nav-row pt-5" : "sidebar-nav-row"}
							data-active={selected}
							data-icon-only={collapsed}
						>
							<Icon aria-hidden="true" className="size-5 shrink-0" />
							<span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>{group.label}</span>
							{total > 0 && (
								<span className={collapsed ? "absolute right-0.5 top-0.5 flex" : undefined}>
									<CountBadge count={total} total />
								</span>
							)}
							{!collapsed && (
								<ChevronDown
									aria-hidden="true"
									className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
								/>
							)}
						</button>
						{!collapsed && open && (
							<div id={groupId} className="ml-5 mt-1 space-y-1 border-l border-[#dfe8df] pl-3">
								{renderLinks(group)}
							</div>
						)}
						{collapsed && open && flyout && (
							<SidebarPopover
								anchor={flyout.anchor}
								id={groupId}
								onClose={() => setFlyout(undefined)}
							>
								<p className="px-2.5 py-2 text-sm font-bold text-[#164027]">{group.label}</p>
								{renderLinks(group, () => setFlyout(undefined))}
							</SidebarPopover>
						)}
					</div>
				);
			})}
		</nav>
	);
}
