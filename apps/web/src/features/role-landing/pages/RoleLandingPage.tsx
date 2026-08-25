import { AlertTriangle, CalendarDays, LayoutDashboard, MapPinned, Menu } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { type RoleBearingUser, getGrantedRoles } from "../../auth/utils/permissions";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { HostCampsitesPanel } from "../../campsites/components/HostCampsitesPanel";
import { ManageCampsiteImagesDialog } from "../../campsites/components/ManageCampsiteImagesDialog";
import { campsitesService } from "../../campsites/services/campsites.service";
import type { CreatedCampsite } from "../../campsites/types";

import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { MetricCard } from "../components/MetricCard";
import { QuickTasksPanel } from "../components/QuickTasksPanel";
import { Sidebar } from "../components/Sidebar";
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

function getDisplayName(user: StoredAuthUser): string {
	return user.email || user.phone || user.id;
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

function useHostCampsites(isEnabled: boolean) {
	const [items, setItems] = useState<CreatedCampsite[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!isEnabled) {
			setItems([]);
			setError("");
			setIsLoading(false);
			return;
		}

		let isMounted = true;
		setIsLoading(true);
		setError("");

		campsitesService
			.getMine()
			.then((data) => {
				if (!isMounted) return;
				setItems(data);
			})
			.catch(() => {
				if (!isMounted) return;
				setItems([]);
				setError("Không thể tải danh sách khu cắm trại của Host.");
			})
			.finally(() => {
				if (!isMounted) return;
				setIsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [isEnabled]);

	return { items, isLoading, error };
}

function DashboardMain({
	config,
	user,
	profile,
	hostCampsites,
	isLoadingHostCampsites,
	hostCampsitesError,
	onOpenProfile,
	onOpenAdminUsers,
	onCreateCampsite,
	onEditCampsite,
	onManageImages,
}: {
	config: DashboardConfig;
	user: StoredAuthUser;
	profile: CamperProfileData | null;
	hostCampsites: CreatedCampsite[];
	isLoadingHostCampsites: boolean;
	hostCampsitesError: string;
	onOpenProfile?: () => void;
	onOpenAdminUsers?: () => void;
	onCreateCampsite?: () => void;
	onEditCampsite?: (id: string) => void;
	onManageImages?: (campsite: CreatedCampsite) => void;
}) {
	const displayName = profile?.fullName || getDisplayName(user);
	const timeOfDay = getTimeOfDay();

	return (
		<main className="flex-1 p-4 sm:p-6 lg:p-8">
			<div className="mx-auto flex max-w-[1440px] flex-col gap-6">
				<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#7b8c82]">
								{config.figmaName}
							</p>
							<h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
								{config.role === "camper" ? `Chào buổi ${timeOfDay}, ${displayName}` : config.title}
							</h1>
							<p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#627769]">
								{config.subtitle}
							</p>
						</div>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{config.metrics.map((metric) => {
						const isProfileMetric = config.role === "camper" && metric.label === "Hồ sơ sức khỏe";
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

				{config.role === "host" && (
					<HostCampsitesPanel
						items={hostCampsites}
						isLoading={isLoadingHostCampsites}
						error={hostCampsitesError}
						onCreateCampsite={onCreateCampsite}
						onEditCampsite={onEditCampsite}
						onManageImages={onManageImages}
					/>
				)}

				<section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
					<div className="overflow-hidden rounded-[28px] border border-[#dfe8df] bg-white shadow-sm">
						<div className="grid min-h-[380px] gap-0 lg:grid-cols-[0.9fr_1.1fr]">
							<div className="p-6" style={{ backgroundColor: config.soft }}>
								<p
									className="text-xs font-extrabold uppercase tracking-wider"
									style={{ color: config.accent }}
								>
									{config.primaryPanel.kicker}
								</p>
								<h2 className="mt-3 text-2xl font-extrabold text-[#10221b]">
									{config.primaryPanel.title}
								</h2>
								<p className="mt-3 text-sm font-medium leading-6 text-[#52665b]">
									{config.primaryPanel.description}
								</p>
								<div className="mt-6 grid gap-3 sm:grid-cols-2">
									{config.primaryPanel.items.map((item) => (
										<div key={item.label} className="rounded-2xl bg-white/80 p-4 ring-1 ring-white">
											<p className="text-xs font-bold text-[#7b8c82]">{item.label}</p>
											<p className="mt-1 text-sm font-extrabold text-[#10221b]">{item.value}</p>
										</div>
									))}
								</div>
							</div>
							<div className="relative min-h-[320px] bg-[#10221b] p-6 text-white">
								<div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,#ffffff_1px,transparent_1px),linear-gradient(#ffffff_1px,transparent_1px)] [background-size:42px_42px]" />
								<div className="relative flex h-full flex-col justify-between">
									<div>
										<div className="flex items-center gap-2 text-sm font-bold text-white/80">
											<MapPinned className="size-4" />
											<span>Bản đồ vận hành</span>
										</div>
										<div className="mt-10 space-y-4">
											<div className="ml-8 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_8px_rgba(110,231,183,0.16)]" />
											<div className="ml-28 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_0_8px_rgba(252,211,77,0.16)]" />
											<div className="ml-52 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,0.16)]" />
										</div>
									</div>
									<div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
										<p className="text-xs font-bold uppercase tracking-wider text-white/60">
											Live status
										</p>
										<p className="mt-1 text-lg font-extrabold">Đồng bộ dữ liệu tuyến</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-extrabold text-[#10221b]">Lịch vận hành</h2>
							<CalendarDays className="size-5 text-[#667a6d]" />
						</div>
						<div className="mt-5 space-y-4">
							{config.timeline.map((item) => (
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
										<p className="mt-1 text-sm leading-6 text-[#627769]">{item.description}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

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
						onOpenAdminUsers={onOpenAdminUsers}
						onCreateCampsite={onCreateCampsite}
					/>
				</section>
			</div>
		</main>
	);
}

export const RoleLandingPage: React.FC<RoleLandingPageProps> = ({
	user,
	roles,
	onOpenProfile,
	onOpenAdminUsers,
	onCreateCampsite,
	onEditCampsite,
	onLogout,
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
	const [selectedRole, setSelectedRole] = useState<RoleKey>(() => normalizedRoles[0] ?? "camper");
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [manageImagesCampsite, setManageImagesCampsite] = useState<CreatedCampsite | null>(null);
	const activeRole = normalizedRoles.includes(selectedRole)
		? selectedRole
		: (normalizedRoles[0] ?? "camper");
	const config = dashboards[activeRole];
	const {
		items: hostCampsites,
		isLoading: isLoadingHostCampsites,
		error: hostCampsitesError,
	} = useHostCampsites(activeRole === "host");
	const handleCamperNav = (navKey: string) => {
		if (navKey === "profile") {
			onOpenProfile?.();
		}
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<div className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
				{activeRole === "camper" ? (
					<CamperSidebar
						profile={profile}
						activeNav="overview"
						onNavigate={handleCamperNav}
						onLogout={onLogout}
					/>
				) : (
					<Sidebar
						config={config}
						grantedRoles={normalizedRoles}
						activeRole={activeRole}
						onRoleChange={setSelectedRole}
						profile={profile}
						onOpenProfile={onOpenProfile}
						onLogout={onLogout}
					/>
				)}
			</div>

			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Đóng menu dashboard"
						onClick={() => setMobileMenuOpen(false)}
						className="absolute inset-0 bg-[#10221b]/45"
					/>
					<div className="relative z-10 h-full shadow-2xl">
						{activeRole === "camper" ? (
							<CamperSidebar
								profile={profile}
								activeNav="overview"
								onLogout={onLogout}
								onNavigate={(navKey) => {
									handleCamperNav(navKey);
									setMobileMenuOpen(false);
								}}
							/>
						) : (
							<Sidebar
								config={config}
								grantedRoles={normalizedRoles}
								activeRole={activeRole}
								onRoleChange={(role) => {
									setSelectedRole(role);
									setMobileMenuOpen(false);
								}}
								onClose={() => setMobileMenuOpen(false)}
								profile={profile}
								onOpenProfile={onOpenProfile}
								onLogout={onLogout}
							/>
						)}
					</div>
				</div>
			)}

			<div className={`min-h-screen ${activeRole === "camper" ? "lg:pl-64" : "lg:pl-72"}`}>
				<header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#dfe8df] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label="Mở menu dashboard"
						className="rounded-xl border border-[#dfe8df] p-2.5 text-[#164027] transition hover:bg-[#f1f5f0]"
					>
						<Menu className="size-5" />
					</button>
					<div className="flex items-center gap-2.5">
						<div
							className="flex size-9 items-center justify-center rounded-lg text-white"
							style={{ backgroundColor: config.accent }}
						>
							<LayoutDashboard className="size-5" />
						</div>
						<p className="font-extrabold">{config.productLabel}</p>
					</div>
				</header>

				<DashboardMain
					config={config}
					user={user}
					profile={profile}
					hostCampsites={hostCampsites}
					isLoadingHostCampsites={isLoadingHostCampsites}
					hostCampsitesError={hostCampsitesError}
					onOpenProfile={onOpenProfile}
					onOpenAdminUsers={onOpenAdminUsers}
					onCreateCampsite={onCreateCampsite}
					onEditCampsite={onEditCampsite}
					onManageImages={setManageImagesCampsite}
				/>
				<ManageCampsiteImagesDialog
					open={manageImagesCampsite !== null}
					campsite={manageImagesCampsite}
					onClose={() => setManageImagesCampsite(null)}
					onUpdateSuccess={(_updated) => {
						setManageImagesCampsite(null);
						window.location.reload();
					}}
				/>
			</div>
		</div>
	);
};
