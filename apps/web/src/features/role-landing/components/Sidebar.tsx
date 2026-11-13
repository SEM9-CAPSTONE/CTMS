import { Clock, Send, UserRound, Users } from "lucide-react";
import { useId, useState } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { RoutePath } from "../../../routes/routes.config";
import { type SidebarControls, SidebarFrame } from "../../../shared/components/SidebarFrame";
import { SidebarPopover } from "../../../shared/components/SidebarPopover";
import { LogoutActions } from "../../auth/components/LogoutActions";
import { BookingCancellationNotices } from "../../booking-cancellation/components/BookingCancellationNotices";
import type { CamperProfileData } from "../../camper-profile/types";
import { useHostSos } from "../../sos-handling/hooks/useHostSos";
import { useMyPorterRequests } from "../../trips/hooks/usePorterRequests";
import { WeatherChangeNotices } from "../../weather/components/WeatherChangeNotices";
import { roleLabels } from "../constants";
import type { DashboardConfig, RoleKey } from "../types";

export interface SidebarProps extends Partial<SidebarControls> {
	config: DashboardConfig;
	grantedRoles: RoleKey[];
	activeRole: RoleKey;
	onRoleChange: (role: RoleKey) => void;
	profile: CamperProfileData | null;
	onOpenProfile?: () => void;
	onNavigateToTrips?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function DashboardRoleSwitcher({
	grantedRoles,
	activeRole,
	onRoleChange,
}: Pick<SidebarProps, "grantedRoles" | "activeRole" | "onRoleChange">) {
	if (grantedRoles.length <= 1) return null;

	return (
		<div className="border-b border-[#e7eee7] px-4 py-4">
			<p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8fa096]">
				Vai trò hiện tại
			</p>
			<div className="mt-2 grid grid-cols-2 gap-1.5">
				{grantedRoles.map((role) => (
					<button
						key={role}
						type="button"
						aria-pressed={role === activeRole}
						onClick={() => onRoleChange(role)}
						className={`rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
							role === activeRole
								? "bg-[#164027] text-white shadow-sm"
								: "bg-[#f8faf7] text-[#55685a] hover:bg-[#eef2ed]"
						}`}
					>
						{roleLabels[role]}
					</button>
				))}
			</div>
		</div>
	);
}

export function Sidebar({
	config,
	grantedRoles,
	activeRole,
	onRoleChange,
	collapsed = false,
	onToggle,
	onClose,
	profile,
	onOpenProfile,
	onNavigateToTrips,
	onLogout,
}: SidebarProps) {
	const porterMenuId = useId();
	const [porterMenuAnchor, setPorterMenuAnchor] = useState<HTMLButtonElement>();
	const porterRequestsQuery = useMyPorterRequests(activeRole === "porter");
	const pendingPorterRequestCount =
		porterRequestsQuery.data?.filter((request) => request.status === "pending").length ?? 0;
	const hostSosQuery = useHostSos(
		{ status: "active", limit: 10 },
		{ enabled: activeRole === "host" }
	);
	const activeSosCount = hostSosQuery.data?.total ?? hostSosQuery.data?.items?.length ?? 0;
	const navigate = (path: string) => {
		guardedNavigation(() => {
			setPorterMenuAnchor(undefined);
			onClose?.();
			window.history.pushState({ ...window.history.state, activeRole }, "", path);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
	};
	const canOpenProfile = activeRole === "porter" || Boolean(onOpenProfile);
	const openProfile = () => {
		if (activeRole === "porter") {
			navigate(RoutePath.PORTER_PROFILE);
			return;
		}
		onOpenProfile?.();
		onClose?.();
	};
	const porterView =
		typeof window === "undefined"
			? "find"
			: (new URLSearchParams(window.location.search).get("view") ?? "find");
	const currentPath = typeof window === "undefined" ? "" : window.location.pathname;
	const currentSearch =
		typeof window === "undefined"
			? new URLSearchParams()
			: new URLSearchParams(window.location.search);
	const isPorterCheckInSelection =
		currentPath === RoutePath.PORTER_ASSIGNMENTS && currentSearch.get("view") === "checkins";
	const isPorterCheckInRoster =
		currentPath.startsWith("/trips/") &&
		currentSearch.get("view") === "roster" &&
		currentSearch.get("from") === "porter-checkins";
	const hostPorterItems = [
		{ key: "find", label: "Tìm người hỗ trợ", icon: Send },
		{ key: "requests", label: "Yêu cầu đã gửi", icon: Clock },
		{ key: "assigned", label: "Người hỗ trợ đã phân công", icon: Users },
	] as const;
	const renderPorterItems = () =>
		hostPorterItems.map(({ key, label, icon: Icon }) => {
			const isActive = window.location.pathname === RoutePath.HOST_PORTER && porterView === key;
			return (
				<button
					key={key}
					type="button"
					onClick={() => navigate(`${RoutePath.HOST_PORTER}?view=${key}`)}
					aria-current={isActive ? "page" : undefined}
					className="sidebar-nav-row"
					data-active={isActive}
					data-child="true"
				>
					<Icon aria-hidden="true" className="size-4 shrink-0" />
					<span>{label}</span>
				</button>
			);
		});

	return (
		<SidebarFrame
			title={`${roleLabels[activeRole]} CTMS`}
			collapsed={collapsed}
			onToggle={onToggle}
			onClose={onClose}
			notices={
				activeRole === "host" && (
					<>
						<WeatherChangeNotices includeDecisions />
						<BookingCancellationNotices />
					</>
				)
			}
			account={{
				name: profile?.fullName || "Người dùng",
				label: "Tài khoản",
				roleLabel: roleLabels[activeRole],
				avatarUrl: profile?.avatarUrl,
				email: profile?.email,
				renderActions: (closeAccount) => (
					<>
						{canOpenProfile && (
							<button
								type="button"
								className="sidebar-nav-row"
								onClick={() => {
									closeAccount();
									openProfile();
								}}
							>
								<UserRound aria-hidden="true" className="size-5 shrink-0" />
								<span>Hồ sơ của tôi</span>
							</button>
						)}
						<DashboardRoleSwitcher
							grantedRoles={grantedRoles}
							activeRole={activeRole}
							onRoleChange={(role) => {
								closeAccount();
								onClose?.();
								onRoleChange(role);
							}}
						/>
						{onLogout && <LogoutActions onLogout={onLogout} />}
					</>
				),
			}}
		>
			<div className={`sidebar-menu ${collapsed ? "px-2" : ""}`}>
				<nav className="space-y-1" aria-label="Dashboard navigation">
					{!collapsed && <p className="sidebar-nav-label">Menu chính</p>}
					{config.navItems.map((item) => {
						const Icon = item.icon;
						const isPathTrips =
							typeof window !== "undefined" && window.location.pathname.startsWith("/trips");
						const isPathDashboard =
							typeof window !== "undefined" &&
							(window.location.pathname === "/dashboard" || window.location.pathname === "/");
						const isPathEquipment =
							typeof window !== "undefined" &&
							window.location.pathname.startsWith("/host/equipment-catalog");
						const isPathWallet =
							typeof window !== "undefined" && window.location.pathname.startsWith("/host/wallet");
						const isPathSos =
							typeof window !== "undefined" &&
							window.location.pathname.startsWith(RoutePath.HOST_SOS);
						const isPathPorter =
							typeof window !== "undefined" && window.location.pathname.startsWith("/host/porter");
						const isPathCampers =
							typeof window !== "undefined" &&
							window.location.pathname.startsWith(RoutePath.HOST_CAMPERS);
						const isPathPorterRequests =
							typeof window !== "undefined" &&
							window.location.pathname.startsWith("/porter/requests");
						const isPathPorterAssignments =
							currentPath === RoutePath.PORTER_ASSIGNMENTS ||
							currentPath.startsWith(`${RoutePath.PORTER_ASSIGNMENTS}/`);
						const isPathPorterProfile = currentPath === RoutePath.PORTER_PROFILE;
						const isPorterGroup = activeRole === "host" && item.key === "porters";
						const showPorterSubmenu = !collapsed && isPorterGroup && isPathPorter;
						const opensFlyout = collapsed && isPorterGroup;
						const showFlyout = opensFlyout && Boolean(porterMenuAnchor);
						const showSosBadge = item.key === "sos" && activeRole === "host" && activeSosCount > 0;
						const showRequestBadge =
							item.key === "requests" && activeRole === "porter" && pendingPorterRequestCount > 0;
						const badgePosition = collapsed ? "absolute right-0.5 top-0.5" : "";
						const hasBadge = showSosBadge || showRequestBadge || Boolean(item.badge);
						const isActive =
							(item.key === "demand-insights" && currentPath === "/host/demand-insights") ||
							(item.key === "explore" && isPathTrips) ||
							(item.key === "review-analysis" && currentPath === "/host/review-analysis") ||
							(item.key === "overview" && isPathDashboard) ||
							(item.key === "sos" && isPathSos) ||
							(item.key === "equipment" && isPathEquipment) ||
							(item.key === "wallet" && isPathWallet) ||
							(item.key === "porters" && isPathPorter) ||
							(item.key === "campers" && isPathCampers) ||
							(item.key === "requests" && isPathPorterRequests) ||
							(item.key === "assignments" &&
								activeRole === "porter" &&
								isPathPorterAssignments &&
								!isPorterCheckInSelection) ||
							(item.key === "checkins" &&
								activeRole === "porter" &&
								(isPorterCheckInSelection || isPorterCheckInRoster)) ||
							(item.key === "profile" && activeRole === "porter" && isPathPorterProfile);

						return (
							<div key={item.key}>
								<button
									type="button"
									disabled={item.disabled}
									aria-current={isActive && !isPorterGroup ? "page" : undefined}
									aria-expanded={opensFlyout ? showFlyout : undefined}
									aria-controls={showFlyout ? porterMenuId : undefined}
									title={collapsed ? item.label : undefined}
									onClick={(event) => {
										if (opensFlyout) {
											setPorterMenuAnchor(showFlyout ? undefined : event.currentTarget);
											return;
										}
										if (item.key === "demand-insights") {
											navigate("/host/demand-insights");
										} else if (item.key === "review-analysis") {
											navigate("/host/review-analysis");
										} else if (item.key === "overview") {
											navigate("/dashboard");
										} else if (item.key === "sos") {
											navigate(RoutePath.HOST_SOS);
										} else if (item.key === "trips") {
											if (activeRole === "host") {
												const element = document.getElementById("host-active-trips");
												if (element) {
													element.scrollIntoView({ behavior: "smooth" });
													onClose?.();
													return;
												}
											}
											navigate("/dashboard");
										} else if (item.key === "explore") {
											if (onNavigateToTrips) {
												onClose?.();
												onNavigateToTrips();
											} else {
												navigate("/trips");
											}
										} else if (item.key === "equipment") {
											navigate("/host/equipment-catalog");
										} else if (item.key === "wallet") {
											navigate("/host/wallet");
										} else if (item.key === "porters") {
											navigate(`${RoutePath.HOST_PORTER}?view=find`);
										} else if (item.key === "campers") {
											navigate(RoutePath.HOST_CAMPERS);
										} else if (item.key === "requests") {
											navigate("/porter/requests");
										} else if (item.key === "assignments" && activeRole === "porter") {
											navigate(RoutePath.PORTER_ASSIGNMENTS);
										} else if (item.key === "checkins" && activeRole === "porter") {
											navigate(`${RoutePath.PORTER_ASSIGNMENTS}?view=checkins`);
										} else if (item.key === "profile") {
											openProfile();
										}
									}}
									className={collapsed && hasBadge ? "sidebar-nav-row pt-5" : "sidebar-nav-row"}
									data-active={isActive}
									data-icon-only={collapsed}
								>
									<Icon aria-hidden="true" className="size-5 shrink-0" />
									<span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>{item.label}</span>
									{showSosBadge ? (
										<span
											aria-label={`${activeSosCount} yêu cầu cứu trợ khẩn cấp`}
											className={`sidebar-count-badge animate-pulse bg-red-600 text-white ${badgePosition}`}
										>
											{activeSosCount}
										</span>
									) : showRequestBadge ? (
										<span
											aria-label={`${pendingPorterRequestCount} yêu cầu đang chờ`}
											className={`sidebar-count-badge bg-red-600 text-white ${badgePosition}`}
										>
											{pendingPorterRequestCount}
										</span>
									) : item.badge ? (
										<span
											className={`sidebar-count-badge bg-[#edf2ee] text-[#627769] ${badgePosition}`}
										>
											{item.badge}
										</span>
									) : null}
								</button>
								{showPorterSubmenu && (
									<div className="ml-5 mt-1 space-y-1 border-l border-[#dfe8df] pl-3">
										{renderPorterItems()}
									</div>
								)}
								{showFlyout && porterMenuAnchor && (
									<SidebarPopover
										anchor={porterMenuAnchor}
										id={porterMenuId}
										onClose={() => setPorterMenuAnchor(undefined)}
									>
										<p className="px-2.5 py-2 text-sm font-bold text-brand-primary">{item.label}</p>
										{renderPorterItems()}
									</SidebarPopover>
								)}
							</div>
						);
					})}
				</nav>
			</div>
		</SidebarFrame>
	);
}
