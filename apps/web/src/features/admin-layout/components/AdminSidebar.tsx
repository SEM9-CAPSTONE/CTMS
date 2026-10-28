import {
	BadgeCheck,
	Compass,
	FileClock,
	Flag,
	Landmark,
	LayoutDashboard,
	ReceiptText,
	Route,
	ShieldAlert,
	Users,
	X,
} from "lucide-react";
import { HomeLink } from "../../../shared/components/HomeLink";
import { LogoutActions } from "../../auth/components/LogoutActions";
import { BookingCancellationNotices } from "../../booking-cancellation/components/BookingCancellationNotices";

export type AdminNavigationItem =
	| "dashboard"
	| "user-accounts"
	| "porter-verifications"
	| "porter-levels"
	| "audit-logs"
	| "content-reports"
	| "route-review"
	| "trip-review"
	| "weather-rules"
	| "refunds"
	| "settlements";

import type { CamperProfileData } from "../../camper-profile/types";

interface AdminSidebarProps {
	activeItem: AdminNavigationItem;
	profile?: CamperProfileData | null;
	onLogout?: (allDevices: boolean) => Promise<void>;
	onClose?: () => void;
	className?: string;
}

const navigationItems = [
	{ key: "dashboard", label: "Bảng điều khiển", icon: LayoutDashboard, available: false },
	{ key: "user-accounts", label: "Tài khoản người dùng", icon: Users, available: true },
	{ key: "porter-verifications", label: "Duyệt hồ sơ Porter", icon: BadgeCheck, available: true },
	{ key: "porter-levels", label: "Cấp độ Porter", icon: BadgeCheck, available: true },
	{ key: "settlements", label: "Quyết toán & Ví Host", icon: Landmark, available: true },
	{ key: "refunds", label: "Quản lý hoàn tiền", icon: ReceiptText, available: true },
	{ key: "route-review", label: "Duyệt tuyến trekking", icon: Route, available: true },
	{ key: "trip-review", label: "Duyệt trip", icon: Compass, available: true },
	{ key: "weather-rules", label: "Cấu hình rủi ro thời tiết", icon: ShieldAlert, available: true },
	{ key: "audit-logs", label: "Nhật ký hệ thống", icon: FileClock, available: true },
	{ key: "content-reports", label: "Báo cáo nội dung", icon: Flag, available: true },
] as const;

export function AdminSidebar({
	activeItem,
	profile,
	onLogout,
	onClose,
	className = "",
}: AdminSidebarProps) {
	return (
		<aside
			className={`flex h-full min-h-0 w-72 flex-col border-r border-[#dfe8df] bg-white ${className}`}
		>
			<div className="flex shrink-0 items-center gap-3 border-b border-[#e7eee7] px-5 py-5">
				<HomeLink className="flex min-w-0 flex-1 items-center gap-3">
					<img
						src="/ctms_logo.png"
						alt="CTMS Logo"
						className="h-10 w-auto object-contain shrink-0"
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate text-base font-extrabold text-[#10221b]">Quản trị CTMS</p>
						<p className="text-xs font-medium text-[#667a6d]">Không gian quản trị</p>
					</div>
				</HomeLink>
				<BookingCancellationNotices />
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng menu quản trị"
						className="rounded-lg p-2 text-[#667a6d] transition hover:bg-[#f1f5f0] hover:text-[#164027] lg:hidden"
					>
						<X className="size-5" />
					</button>
				)}
			</div>

			<nav
				aria-label="Administration navigation"
				className="min-h-0 flex-1 overflow-y-auto space-y-1.5 px-4 py-5"
			>
				{navigationItems.map((item) => {
					const Icon = item.icon;
					const isActive = activeItem === item.key;

					return (
						<button
							key={item.key}
							type="button"
							disabled={!item.available}
							onClick={() => {
								if (item.key === "content-reports") {
									window.history.pushState({}, "", "/admin/content-reports");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "user-accounts") {
									window.history.pushState({}, "", "/admin/users");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "porter-verifications") {
									window.history.pushState({}, "", "/admin/porter-verifications");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "porter-levels") {
									window.history.pushState({}, "", "/admin/porter-levels");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "audit-logs") {
									window.history.pushState({}, "", "/admin/audit-logs");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "route-review") {
									window.history.pushState({}, "", "/admin/trekking-routes");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "trip-review") {
									window.history.pushState({}, "", "/admin/trips");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "weather-rules") {
									window.history.pushState({}, "", "/admin/weather-rules");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "settlements") {
									window.history.pushState({}, "", "/admin/settlements");
									window.dispatchEvent(new PopStateEvent("popstate"));
								} else if (item.key === "refunds") {
									window.history.pushState({}, "", "/admin/refunds");
									window.dispatchEvent(new PopStateEvent("popstate"));
								}
							}}
							aria-current={isActive ? "page" : undefined}
							className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold transition ${
								isActive
									? "bg-[#e8f0e6] text-[#164027] shadow-sm"
									: item.available
										? "text-[#425048] hover:bg-[#f1f5f0] hover:text-[#164027]"
										: "cursor-not-allowed text-[#98a69d]"
							}`}
						>
							<Icon className="size-5 shrink-0" />
							<span className="flex-1">{item.label}</span>
							{!item.available && (
								<span className="rounded-full bg-[#f1f5f0] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#7d8d83]">
									Sắp ra mắt
								</span>
							)}
						</button>
					);
				})}
			</nav>

			<div className="shrink-0 border-t border-[#e7eee7] p-4 flex flex-col gap-3">
				{profile && (
					<div className="flex items-center gap-3 rounded-2xl border border-[#e0ebe0] bg-[#f8faf8] p-3">
						<img
							src={
								profile.avatarUrl ||
								"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
							}
							alt={profile.fullName}
							className="size-10 rounded-full object-cover ring-2 ring-[#164027]/20"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<p className="truncate text-sm font-extrabold text-[#10221b]">{profile.fullName}</p>
								<span className="rounded bg-[#164027] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
									Admin
								</span>
							</div>
							<p className="truncate text-[11px] font-semibold text-[#667a6d]">{profile.email}</p>
						</div>
					</div>
				)}
				{onLogout && <LogoutActions onLogout={onLogout} />}
			</div>
		</aside>
	);
}
