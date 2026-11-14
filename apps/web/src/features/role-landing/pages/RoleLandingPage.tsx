import { AlertTriangle, CalendarDays, LayoutDashboard } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { type RoleBearingUser, getGrantedRoles } from "../../auth/utils/permissions";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { HostDashboardHeader } from "../../host-overview/components/HostDashboardHeader";
import { HostDashboardOverview } from "../../host-overview/components/HostDashboardOverview";
import { DepartureInbox } from "../../offline-package-policy/components/DepartureInbox";
import { CamperOperationalMap } from "../components/CamperOperationalMap";
import { CamperTripPager } from "../components/CamperTripPager";
import { HostOperationalOverview } from "../components/HostOperationalOverview";
import { PorterOperationalMap } from "../components/PorterOperationalMap";
import { useCamperTripCarousel } from "../hooks/useCamperTripCarousel";

import { Button } from "../../../shared/components/Button";
import { SidebarLayout } from "../../../shared/components/SidebarLayout";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { MetricCard } from "../components/MetricCard";
import { OperationalSidebarLayout } from "../components/OperationalSidebarLayout";
import { QuickTasksPanel } from "../components/QuickTasksPanel";
import { DashboardRoleSwitcher } from "../components/Sidebar";
import { alertClasses, dashboards } from "../constants";
import type { DashboardConfig, RoleKey, RoleLandingPageProps } from "../types";

function toRoleKey(role: string): RoleKey | null {
	const lowercase = role.toLowerCase();
	if (
		lowercase === "camper" ||
		lowercase === "host" ||
		lowercase === "porter" ||
		lowercase === "admin"
	) {
		return lowercase as RoleKey;
	}
	return null;
}

function getHistoryActiveRole(): RoleKey | null {
	const historyState: unknown = window.history.state;
	if (!historyState || typeof historyState !== "object" || !("activeRole" in historyState)) {
		return null;
	}

	const activeRole = (historyState as { activeRole?: unknown }).activeRole;
	return typeof activeRole === "string" ? toRoleKey(activeRole) : null;
}

function getDisplayName(user: StoredAuthUser): string {
	return user.fullName || user.email || user.phone || "Người dùng";
}

function getTimeOfDay(date = new Date()) {
	const hour = date.getHours();
	if (hour < 11) {
		return "sáng";
	}
	if (hour < 18) {
		return "chiều";
	}
	return "tối";
}

function useDashboardProfile() {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);

	useEffect(() => {
		let isMounted = true;

		camperProfileService
			.getProfile()
			.then((data) => {
				if (!isMounted) return;
				setProfile(data);
			})
			.catch(() => {
				if (!isMounted) return;
				setProfile(null);
			})
			.finally(() => {
				if (!isMounted) return;
				setIsLoadingProfile(false);
			});

		return () => {
			isMounted = false;
		};
	}, []);

	return { profile, isLoadingProfile };
}

function DashboardMain({
	config,
	user,
	profile,
	onOpenProfile,
	onCreateTrip,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onNavigateToTrips,
	onNavigateToTripDetail,
}: {
	config: DashboardConfig;
	user: StoredAuthUser;
	profile: CamperProfileData | null;
	onOpenProfile?: () => void;
	onCreateTrip?: () => void;
	onCreateTrekkingRoute?: () => void;
	onViewTrekkingRoutes?: () => void;
	onNavigateToTrips?: () => void;
	onNavigateToTripDetail?: (tripId: string) => void;
}) {
	const displayName = profile?.fullName || getDisplayName(user);
	const timeOfDay = getTimeOfDay();
	const carousel = useCamperTripCarousel(user.id, config.role === "camper");
	const displayedTrip = carousel.trip;
	const exploreShownTrip =
		displayedTrip && !carousel.isLoading && !carousel.isError
			? () => {
					if (onNavigateToTripDetail) onNavigateToTripDetail(displayedTrip.id);
					else {
						window.history.pushState({}, "", `/trips/${displayedTrip.id}`);
						window.dispatchEvent(new PopStateEvent("popstate"));
					}
				}
			: undefined;

	const timeline =
		config.role === "camper"
			? [...(displayedTrip?.waypoints ?? [])]
					.sort((a, b) => a.dayNumber - b.dayNumber || a.sequenceOrder - b.sequenceOrder)
					.map((item) => ({
						time: item.plannedAt
							? new Date(item.plannedAt).toLocaleTimeString("vi-VN", {
									hour: "2-digit",
									minute: "2-digit",
								})
							: "—",
						title: item.name,
						status: "Lịch trình",
						description: item.durationMinutes
							? `Thời lượng: ${item.durationMinutes} phút.`
							: "Theo lịch trình chuyến đi.",
					}))
			: config.timeline;
	return (
		<main
			className={
				config.role === "host"
					? "min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
					: "flex-1 p-4 sm:p-6 lg:p-8"
			}
		>
			<div
				className={
					config.role === "host"
						? "flex w-full flex-col gap-4"
						: "mx-auto flex max-w-[1440px] flex-col gap-6"
				}
			>
				{config.role === "host" ? (
					<div className="sticky top-0 z-20 shrink-0 bg-[#f4f7f2]">
						<div className="mx-auto w-full max-w-[1504px] space-y-4 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
							<HostDashboardHeader name={displayName} onCreateTrip={onCreateTrip} />
							<HostDashboardOverview key={user.id} hostId={user.id} />
						</div>
					</div>
				) : (
					<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
							<div className="min-w-0">
								{config.figmaName ? (
									<p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#7b8c82]">
										{config.figmaName}
									</p>
								) : null}
								<h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
									{config.role === "camper"
										? `Chào buổi ${timeOfDay}, ${displayName}`
										: config.title}
								</h1>
								<p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#627769]">
									{config.subtitle}
								</p>
							</div>
						</div>
					</section>
				)}

				<div className="contents">
					<div
						className={
							config.role === "host"
								? "mx-auto w-full max-w-[1504px] space-y-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8"
								: "contents"
						}
					>
						{config.role === "host" ? (
							<>
								<HostOperationalOverview
									key={`operations-${user.id}`}
									hostId={user.id}
									onNavigateToTripDetail={onNavigateToTripDetail}
									showMetrics={false}
									showToolbar={false}
								/>
							</>
						) : (
							<>
								<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									{config.metrics.map((metric) => {
										const isProfileMetric =
											config.role === "camper" && metric.label === "Hồ sơ sức khỏe";
										return isProfileMetric ? (
											<button
												key={metric.label}
												type="button"
												onClick={onOpenProfile}
												className="text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#164027]/30"
											>
												<MetricCard metric={metric} />
											</button>
										) : (
											<MetricCard key={metric.label} metric={metric} />
										);
									})}
								</section>

								<section
									id="camper-active-trip"
									className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
								>
									<div className="min-w-0 overflow-hidden rounded-[28px] border border-[#dfe8df] bg-white shadow-sm">
										{config.role === "camper" && (
											<>
												{carousel.isLoading ? (
													<p className="p-6">Đang tải chuyến đi...</p>
												) : carousel.isError ? (
													<button type="button" onClick={carousel.retry} className="p-6 underline">
														Không tải được chuyến đi. Thử lại
													</button>
												) : carousel.trip ? (
													<CamperOperationalMap
														userId={user.id}
														trip={carousel.trip}
														isBooked={carousel.isBooked}
														navigation={
															<CamperTripPager
																index={carousel.index}
																canPrevious={carousel.canPrevious}
																canNext={carousel.canNext}
																disabled={carousel.isLoading || carousel.isPaging}
																onPrevious={carousel.previous}
																onNext={() => void carousel.next()}
															/>
														}
													/>
												) : (
													<p className="p-6">Chưa có chuyến sắp khởi hành hoặc đang hoạt động.</p>
												)}
												{carousel.listError && (
													<button type="button" onClick={carousel.retry} className="p-4 underline">
														Không tải được các chuyến khác. Thử lại
													</button>
												)}
											</>
										)}
										{config.role === "porter" && <PorterOperationalMap />}
									</div>

									<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
										<div className="flex items-center justify-between">
											<h2 className="text-xl font-extrabold text-[#10221b]">Lịch vận hành</h2>
											<CalendarDays className="size-5 text-[#667a6d]" />
										</div>
										<div className="mt-5 space-y-4">
											{timeline.length === 0 && (
												<p className="text-sm text-[#627769]">
													Chưa có lịch trình chi tiết cho chuyến đang xem.
												</p>
											)}
											{timeline.map((item) => (
												<div key={`${item.time}-${item.title}`} className="flex gap-4">
													<div
														className="w-14 shrink-0 text-sm font-extrabold"
														style={{ color: config.accent }}
													>
														{item.time}
													</div>
													<div className="flex-1 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
														<div className="flex items-start justify-between gap-3">
															<h3 className="font-extrabold text-[#10221b]">{item.title}</h3>
															<span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#667a6d] ring-1 ring-[#dfe8df]">
																{item.status}
															</span>
														</div>
														<p className="mt-1 text-sm leading-6 text-[#627769]">
															{item.description}
														</p>
													</div>
												</div>
											))}
										</div>
									</div>
								</section>
							</>
						)}
						{config.role === "host" ? null : config.role === "porter" ? null : config.alerts
								.length > 0 ? (
							<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
								<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
									<div className="flex items-center justify-between">
										<h2 className="text-xl font-extrabold text-[#10221b]">Cảnh báo</h2>
										<AlertTriangle className="size-5 text-amber-600" />
									</div>
									<div className="mt-5 space-y-3">
										{config.alerts.map((alert) => (
											<div
												key={alert.title}
												className={`rounded-2xl border p-4 ${alertClasses[alert.tone]}`}
											>
												<p className="font-extrabold">{alert.title}</p>
												<p className="mt-1 text-sm leading-6 opacity-80">{alert.detail}</p>
											</div>
										))}
									</div>
								</div>

								<QuickTasksPanel
									config={config}
									onCreateTrip={onCreateTrip}
									onCreateTrekkingRoute={onCreateTrekkingRoute}
									onViewTrekkingRoutes={onViewTrekkingRoutes}
									onNavigateToTrips={config.role === "camper" ? undefined : onNavigateToTrips}
									onExploreTrip={exploreShownTrip}
								/>
							</section>
						) : (
							<section>
								<QuickTasksPanel
									config={config}
									onCreateTrip={onCreateTrip}
									onCreateTrekkingRoute={onCreateTrekkingRoute}
									onViewTrekkingRoutes={onViewTrekkingRoutes}
									onNavigateToTrips={config.role === "camper" ? undefined : onNavigateToTrips}
									onExploreTrip={exploreShownTrip}
								/>
							</section>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}

export const RoleLandingPage: React.FC<RoleLandingPageProps> = ({
	user,
	roles,
	onOpenProfile,
	onOpenAdminUsers,
	onCreateTrip,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onNavigateToTrips,
	onNavigateToBookings,
	onNavigateToTripDetail,
	onNavigateToHostTripDetail,
	onLogout,
	onExplore,
}) => {
	const { profile } = useDashboardProfile();
	const grantedRoles = useMemo(() => {
		const roleBearingUser: RoleBearingUser = {
			role: user.role,
			roles: [...roles],
		};
		return getGrantedRoles(roleBearingUser)
			.map(toRoleKey)
			.filter((role): role is RoleKey => Boolean(role));
	}, [roles, user.role]);
	const normalizedRoles = Array.from(new Set(grantedRoles));
	const [selectedRole, setSelectedRole] = useState<RoleKey>(() => {
		const historyActiveRole = getHistoryActiveRole();
		return historyActiveRole && normalizedRoles.includes(historyActiveRole)
			? historyActiveRole
			: (normalizedRoles[0] ?? "camper");
	});
	const activeRole = normalizedRoles.includes(selectedRole)
		? selectedRole
		: (normalizedRoles[0] ?? "camper");
	const handleRoleChange = (role: RoleKey) => {
		window.history.replaceState({ ...window.history.state, activeRole: role }, "");
		setSelectedRole(role);
	};

	if (activeRole === "admin") {
		return (
			<AdminLayout
				activeItem="dashboard"
				allowMobile
				profile={profile}
				onLogout={onLogout}
				roleSwitcher={
					<DashboardRoleSwitcher
						grantedRoles={normalizedRoles}
						activeRole={activeRole}
						onRoleChange={handleRoleChange}
					/>
				}
			>
				<section className="m-4 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm sm:m-6 lg:m-8">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">
							Trung tâm quản trị
						</h1>
						<span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
							Coming soon
						</span>
					</div>
					{onOpenAdminUsers && (
						<Button onClick={onOpenAdminUsers} variant="outline">
							Quản lý người dùng
						</Button>
					)}
				</section>
			</AdminLayout>
		);
	}

	const config = dashboards[activeRole];
	const handleOpenProfile = () => onOpenProfile?.(activeRole);
	const handleCamperNav = (navKey: string) => {
		if (navKey === "profile") {
			handleOpenProfile();
		} else if (navKey === "explore") {
			if (onExplore) {
				onExplore();
			} else if (onNavigateToTrips) {
				onNavigateToTrips();
			} else {
				window.history.pushState({}, "", "/trips");
				window.dispatchEvent(new PopStateEvent("popstate"));
			}
		} else if (navKey === "bookings") {
			onNavigateToBookings?.();
		} else if (navKey === "trips") {
			const element =
				document.getElementById("camper-active-trip") || document.querySelector("main");
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
			}
		}
	};
	const dashboardContent = (
		<DashboardMain
			config={config}
			user={user}
			profile={profile}
			onOpenProfile={handleOpenProfile}
			onCreateTrip={onCreateTrip}
			onCreateTrekkingRoute={onCreateTrekkingRoute}
			onViewTrekkingRoutes={onViewTrekkingRoutes}
			onNavigateToTrips={onNavigateToTrips}
			onNavigateToTripDetail={
				activeRole === "host"
					? (onNavigateToHostTripDetail ?? onNavigateToTripDetail)
					: onNavigateToTripDetail
			}
		/>
	);

	if (activeRole !== "camper") {
		return (
			<OperationalSidebarLayout
				config={config}
				grantedRoles={normalizedRoles}
				activeRole={activeRole}
				onRoleChange={handleRoleChange}
				profile={profile}
				onOpenProfile={handleOpenProfile}
				onNavigateToTrips={onNavigateToTrips}
				onLogout={onLogout}
				allowMobile
				fixedViewport={activeRole === "host"}
			>
				{activeRole === "host" && grantedRoles.includes("host") && (
					<DepartureInbox key={user.id} actor={user.id} />
				)}
				{dashboardContent}
			</OperationalSidebarLayout>
		);
	}

	return (
		<SidebarLayout
			title={config.productLabel}
			storageKey="ctms:camper-sidebar-collapsed"
			collapseMode="hide"
			allowMobile
			mobileBrand={
				<div className="flex items-center gap-2.5">
					<div
						className="flex size-9 items-center justify-center rounded-lg text-white"
						style={{ backgroundColor: config.accent }}
					>
						<LayoutDashboard aria-hidden="true" className="size-5" />
					</div>
					<p className="font-extrabold">{config.productLabel}</p>
				</div>
			}
			renderSidebar={({ onClose }) => (
				<CamperSidebar
					profile={profile}
					activeNav="overview"
					onLogout={onLogout}
					onNavigate={(navKey) => {
						handleCamperNav(navKey);
						onClose?.();
					}}
					className="h-full w-full"
				/>
			)}
		>
			{dashboardContent}
		</SidebarLayout>
	);
};
