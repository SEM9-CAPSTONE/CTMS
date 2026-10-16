import { Menu } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Collapse } from "../../../shared/components/Collapse";
import { HomeLink } from "../../../shared/components/HomeLink";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { type AdminNavigationItem, AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
	activeItem: AdminNavigationItem;
	children: React.ReactNode;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminLayout({ activeItem, children, onLogout }: AdminLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

			{/* Mobile Sidebar overlay */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Close administration menu"
						onClick={() => setMobileMenuOpen(false)}
						className="absolute inset-0 bg-[#10221b]/45"
					/>
					<AdminSidebar
						activeItem={activeItem}
						profile={profile}
						onLogout={onLogout}
						onClose={() => setMobileMenuOpen(false)}
						className="relative z-10 shadow-2xl"
					/>
				</div>
			)}

			<div
				className={`min-h-screen transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-0" : "lg:pl-72"}`}
			>
				<header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#dfe8df] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label="Open administration menu"
						className="rounded-xl border border-[#dfe8df] p-2.5 text-[#164027] transition hover:bg-[#f1f5f0]"
					>
						<Menu className="size-5" />
					</button>
					<HomeLink className="flex items-center gap-2.5">
						<img src="/ctms_logo.png" alt="CTMS Logo" className="h-8 w-auto object-contain" />
						<p className="font-extrabold text-[#10221b]">Quản trị CTMS</p>
					</HomeLink>
				</header>

				<main>{children}</main>
			</div>
		</div>
	);
}
