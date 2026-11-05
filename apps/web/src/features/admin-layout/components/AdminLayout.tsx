import type React from "react";
import { useEffect, useState } from "react";
import { Collapse } from "../../../shared/components/Collapse";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { type AdminNavigationItem, AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
	allowMobile?: boolean;
	activeItem: AdminNavigationItem;
	children: React.ReactNode;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminLayout({
	activeItem,
	children,
	onLogout,
	allowMobile = false,
}: AdminLayoutProps) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [profile, setProfile] = useState<CamperProfileData | null>(null);

	useEffect(() => {
		let isMounted = true;
		const stored = getStoredAuthUser();
		if (stored) {
			setProfile(
				(prev) =>
					prev ??
					({
						id: stored.id,
						accountStatus: "active",
						fullName: stored.fullName || "Administrator",
						email: stored.email || "admin@ctms.local",
						phone: stored.phone || "",
						avatarUrl:
							"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
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
	}, []);

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			{/* Desktop Sidebar Wrap */}
			<div className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
				<Collapse
					isCollapsed={isSidebarCollapsed}
					onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
					widthClass="w-72"
				>
					<AdminSidebar
						activeItem={activeItem}
						profile={profile}
						onLogout={onLogout}
						className="h-full w-full"
					/>
				</Collapse>
			</div>

			<div
				className={`min-h-screen transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-0" : "lg:pl-72"}`}
			>
				{!allowMobile && (
					<div className="flex min-h-dvh items-center justify-center bg-[#f4f7f2] p-6 text-center lg:hidden">
						<section className="max-w-md rounded-3xl border border-[#dfe8df] bg-white p-8 shadow-sm">
							<h1 className="text-xl font-extrabold text-[#164027]">
								Vui lòng mở CTMS trên máy tính
							</h1>
							<p className="mt-2 text-sm leading-6 text-[#627769]">
								Khu vực quản lý Host và Quản trị viên được thiết kế để sử dụng trên màn hình máy
								tính.
							</p>
						</section>
					</div>
				)}

				<main className={allowMobile ? undefined : "hidden lg:block"}>{children}</main>
			</div>
		</div>
	);
}
