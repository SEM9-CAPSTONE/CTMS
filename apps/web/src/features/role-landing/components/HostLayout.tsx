import { Menu } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Collapse } from "../../../shared/components/Collapse";
import { getGrantedRoles } from "../../auth/utils/permissions";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { dashboards } from "../constants";
import type { RoleKey } from "../types";
import { Sidebar } from "./Sidebar";

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

export interface HostLayoutProps {
	children: React.ReactNode;
	activeRole?: RoleKey;
	onNavigateToTrips?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function HostLayout({ children, activeRole, onNavigateToTrips, onLogout }: HostLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [profile, setProfile] = useState<CamperProfileData | null>(null);

	const storedUser = getStoredAuthUser();
	const grantedRoles = useMemo(() => {
		if (!storedUser) return ["host" as RoleKey];
		return getGrantedRoles(storedUser)
			.map(toRoleKey)
			.filter((role): role is RoleKey => Boolean(role));
	}, [storedUser]);

	const normalizedRoles = Array.from(new Set(grantedRoles));
	const currentRole: RoleKey =
		activeRole || (normalizedRoles.includes("host") ? "host" : normalizedRoles[0] || "host");
	const config = dashboards[currentRole] || dashboards.host;

	useEffect(() => {
		let isMounted = true;
		camperProfileService
			.getProfile()
			.then((data) => {
				if (isMounted) setProfile(data);
			})
			.catch(() => {
				if (isMounted) setProfile(null);
			});
		return () => {
			isMounted = false;
		};
	}, []);

	const handleRoleChange = (role: RoleKey) => {
		if (role === "camper") {
			window.history.pushState({}, "", "/");
		} else {
			window.history.pushState({}, "", "/dashboard");
		}
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const handleCamperNav = (key: string) => {
		if (key === "overview" || key === "trips") {
			window.history.pushState({}, "", "/dashboard");
		} else if (key === "profile") {
			window.history.pushState({}, "", "/profile");
		} else if (key === "explore") {
			if (onNavigateToTrips) {
				onNavigateToTrips();
				return;
			}
			window.history.pushState({}, "", "/trips");
		}
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const sidebarWidthClass = currentRole === "camper" ? "w-64" : "w-72";
	const contentPaddingClass =
		currentRole === "camper"
			? isSidebarCollapsed
				? "lg:pl-0"
				: "lg:pl-64"
			: isSidebarCollapsed
				? "lg:pl-0"
				: "lg:pl-72";

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			{/* Desktop Sidebar */}
			<div className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
				<Collapse
					isCollapsed={isSidebarCollapsed}
					onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
					widthClass={sidebarWidthClass}
				>
					{currentRole === "camper" ? (
						<CamperSidebar
							profile={profile}
							activeNav="explore"
							onNavigate={handleCamperNav}
							onLogout={onLogout}
							className="h-full w-full"
						/>
					) : (
						<Sidebar
							config={config}
							grantedRoles={normalizedRoles}
							activeRole={currentRole}
							onRoleChange={handleRoleChange}
							profile={profile}
							onNavigateToTrips={onNavigateToTrips}
							onLogout={onLogout}
						/>
					)}
				</Collapse>
			</div>

			{/* Mobile Sidebar overlay */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Đóng menu"
						onClick={() => setMobileMenuOpen(false)}
						className="absolute inset-0 bg-[#10221b]/45"
					/>
					<div className="relative z-10 h-full shadow-2xl">
						{currentRole === "camper" ? (
							<CamperSidebar
								profile={profile}
								activeNav="explore"
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
								activeRole={currentRole}
								onRoleChange={(role) => {
									handleRoleChange(role);
									setMobileMenuOpen(false);
								}}
								onClose={() => setMobileMenuOpen(false)}
								profile={profile}
								onNavigateToTrips={onNavigateToTrips}
								onLogout={onLogout}
							/>
						)}
					</div>
				</div>
			)}

			{/* Main Content Area */}
			<div className={`min-h-screen transition-all duration-300 ${contentPaddingClass}`}>
				<header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#dfe8df] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label="Mở menu"
						className="rounded-xl border border-[#dfe8df] p-2.5 text-[#164027] transition hover:bg-[#f1f5f0]"
					>
						<Menu className="size-5" />
					</button>
					<div className="flex items-center gap-2.5">
						<img src="/ctms_logo.png" alt="CTMS Logo" className="h-8 w-auto object-contain" />
						<p className="font-extrabold text-[#10221b]">{config.productLabel}</p>
					</div>
				</header>

				<main>{children}</main>
			</div>
		</div>
	);
}
