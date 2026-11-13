import type { ReactNode } from "react";
import { type SidebarControls, SidebarFrame } from "../../../shared/components/SidebarFrame";
import { LogoutActions } from "../../auth/components/LogoutActions";
import { BookingCancellationNotices } from "../../booking-cancellation/components/BookingCancellationNotices";
import type { CamperProfileData } from "../../camper-profile/types";
import { WeatherChangeNotices } from "../../weather/components/WeatherChangeNotices";
import type { AdminNavigationItem } from "../constants";
import { useAdminModerationCounts } from "../hooks/useAdminModerationCounts";
import { AdminSidebarNavigation } from "./AdminSidebarNavigation";

interface AdminSidebarProps extends SidebarControls {
	activeItem: AdminNavigationItem;
	profile?: CamperProfileData | null;
	roleSwitcher?: ReactNode;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminSidebar({
	activeItem,
	collapsed,
	onToggle,
	onClose,
	profile,
	roleSwitcher,
	onLogout,
}: AdminSidebarProps) {
	const counts = useAdminModerationCounts();

	return (
		<SidebarFrame
			title="Quản trị CTMS"
			collapsed={collapsed}
			onToggle={onToggle}
			onClose={onClose}
			notices={
				<>
					<WeatherChangeNotices includeChanges={false} includeDecisions />
					<BookingCancellationNotices />
				</>
			}
			account={{
				name: profile?.fullName || "Quản trị viên",
				label: "Tài khoản quản trị",
				roleLabel: "Quản trị viên",
				avatarUrl: profile?.avatarUrl,
				email: profile?.email,
				renderActions: () => (
					<>
						{roleSwitcher}
						{onLogout && <LogoutActions onLogout={onLogout} />}
					</>
				),
			}}
		>
			<AdminSidebarNavigation
				activeItem={activeItem}
				collapsed={collapsed}
				counts={counts.data}
				onNavigate={onClose}
			/>
		</SidebarFrame>
	);
}
