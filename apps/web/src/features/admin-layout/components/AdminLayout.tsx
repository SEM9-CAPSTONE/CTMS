import type React from "react";
import { useEffect, useState } from "react";
import { SidebarLayout } from "../../../shared/components/SidebarLayout";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { ADMIN_SIDEBAR_STORAGE_KEY, type AdminNavigationItem } from "../constants";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
	allowMobile?: boolean;
	activeItem: AdminNavigationItem;
	children: React.ReactNode;
	profile?: CamperProfileData | null;
	roleSwitcher?: React.ReactNode;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminLayout({
	activeItem,
	children,
	profile: suppliedProfile,
	roleSwitcher,
	onLogout,
	allowMobile = false,
}: AdminLayoutProps) {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const shouldLoadProfile = suppliedProfile === undefined;

	useEffect(() => {
		if (!shouldLoadProfile) return;
		let isMounted = true;
		const stored = getStoredAuthUser();
		if (stored) {
			setProfile(
				(prev) =>
					prev ??
					({
						id: stored.id,
						accountStatus: "active",
						fullName: stored.fullName || "Quản trị viên",
						email: stored.email || "",
						phone: stored.phone || "",
						avatarUrl: "",
						isProMember: false,
						joinedYear: 2024,
						dateOfBirth: "",
						gender: "other",
						address: "",
						bio: "",
						campingExperienceYears: 0,
						trekkingExperienceDetails: "",
						languages: [],
						emergencyContacts: [],
						completionPercentage: 100,
						emergencyContactAdded: false,
						phoneVerified: true,
					} as CamperProfileData)
			);
		}

		camperProfileService
			.getProfile()
			.then((data) => {
				if (isMounted && data) {
					setProfile(data);
				}
			})
			.catch(() => {
				// Keep fallback from storedUser if API fails
			});

		return () => {
			isMounted = false;
		};
	}, [shouldLoadProfile]);

	return (
		<SidebarLayout
			title="Quản trị"
			storageKey={ADMIN_SIDEBAR_STORAGE_KEY}
			allowMobile={allowMobile}
			renderSidebar={(controls) => (
				<AdminSidebar
					{...controls}
					activeItem={activeItem}
					profile={shouldLoadProfile ? profile : suppliedProfile}
					roleSwitcher={roleSwitcher}
					onLogout={onLogout}
				/>
			)}
		>
			<main>{children}</main>
		</SidebarLayout>
	);
}
