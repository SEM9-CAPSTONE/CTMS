import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { RoutePath } from "../../../routes/routes.config";
import { HomeLink } from "../../../shared/components/HomeLink";
import { SidebarLayout } from "../../../shared/components/SidebarLayout";
import { getGrantedRoles } from "../../auth/utils/permissions";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { DepartureInbox } from "../../offline-package-policy/components/DepartureInbox";
import { dashboards } from "../constants";
import type { DashboardConfig, RoleKey } from "../types";
import { OperationalSidebarLayout } from "./OperationalSidebarLayout";

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
	allowMobile?: boolean;
	children: React.ReactNode;
	activeRole?: DashboardConfig["role"];
	onNavigateToTrips?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function HostLayout({
	children,
	activeRole,
	onNavigateToTrips,
	onLogout,
	allowMobile = false,
}: HostLayoutProps) {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);

	const storedUser = getStoredAuthUser();
	const grantedRoles = useMemo(() => {
		if (!storedUser) return ["host" as RoleKey];
		return getGrantedRoles(storedUser)
			.map(toRoleKey)
			.filter((role): role is RoleKey => Boolean(role));
	}, [storedUser]);

	const normalizedRoles = Array.from(new Set(grantedRoles));
	const inferredRole = normalizedRoles.includes("host")
		? "host"
		: normalizedRoles.find((role) => role !== "admin");
	const currentRole = activeRole ?? inferredRole ?? "host";
	const config = dashboards[currentRole];

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
		guardedNavigation(() => {
			const path = role === "camper" ? RoutePath.HOME : RoutePath.DASHBOARD;
			window.history.pushState({ activeRole: role }, "", path);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
	};

	if (currentRole !== "camper") {
		return (
			<OperationalSidebarLayout
				config={config}
				grantedRoles={normalizedRoles}
				activeRole={currentRole}
				onRoleChange={handleRoleChange}
				profile={profile}
				onNavigateToTrips={onNavigateToTrips}
				onLogout={onLogout}
				allowMobile={allowMobile || currentRole === "porter"}
			>
				{currentRole === "host" && storedUser && grantedRoles.includes("host") && (
 <DepartureInbox key={storedUser.id} actor={storedUser.id} />
)}
<main>{children}</main>
			</OperationalSidebarLayout>
		);
	}

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
		} else if (key === "bookings") {
			window.history.pushState({}, "", "/bookings");
		}
		window.dispatchEvent(new PopStateEvent("popstate"));
	};
	const currentPath = window.location.pathname.toLowerCase();
	const activeCamperNav = currentPath.startsWith("/bookings")
		? "bookings"
		: currentPath.startsWith("/profile") || currentPath.startsWith("/camper/profile")
			? "profile"
			: currentPath.startsWith("/trips")
				? "explore"
				: "overview";

	return (
		<SidebarLayout
			title={config.productLabel}
			storageKey="ctms:camper-sidebar-collapsed"
			collapseMode="hide"
			allowMobile
			mobileBrand={
				<HomeLink className="flex items-center gap-2.5">
					<img src="/ctms_logo.png" alt="CTMS Logo" className="h-8 w-auto object-contain" />
					<p className="font-bold text-brand-dark">{config.productLabel}</p>
				</HomeLink>
			}
			renderSidebar={({ onClose }) => (
				<CamperSidebar
					profile={profile}
					activeNav={activeCamperNav}
					onLogout={onLogout}
					onNavigate={(navKey) => {
						handleCamperNav(navKey);
						onClose?.();
					}}
					className="h-full w-full"
				/>
			)}
		>
			<main>{children}</main>
		</SidebarLayout>
	);
}
