import {
	Compass,
	LayoutDashboard,
	LogOut,
	MapPin,
	Shield,
	Sparkles,
	Tent,
	UserCheck,
} from "lucide-react";
import type { CamperProfileData } from "../types";

interface CamperSidebarProps {
	profile: CamperProfileData | null;
	activeNav?: string;
	onNavigate?: (navKey: string) => void;
}

export function CamperSidebar({ profile, activeNav = "profile", onNavigate }: CamperSidebarProps) {
	const navItems = [
		{ key: "overview", label: "Tổng quan", icon: LayoutDashboard },
		{ key: "explore", label: "Khám phá địa điểm", icon: MapPin },
		{ key: "bookings", label: "Đơn đặt chỗ", icon: Tent },
		{ key: "trips", label: "Chuyến đi của tôi", icon: Compass },
		{ key: "profile", label: "Hồ sơ & Cài đặt", icon: UserCheck },
		{ key: "safety", label: "Trung tâm an toàn", icon: Shield },
	];

	return (
		<aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-[#dfe8df] bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-6">
				{/* Brand Logo */}
				<div className="flex items-center gap-3 px-2 pt-1">
					<img
						src="/ctms_logo.png"
						alt="CTMS Logo"
						className="h-10 w-auto object-contain shrink-0"
					/>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-extrabold text-[#164027] text-lg tracking-tight">CTMS</span>
							<span className="rounded-md bg-[#eef7f0] px-1.5 py-0.5 font-bold text-[10px] uppercase text-[#164027]">
								Camper
							</span>
						</div>
						<p className="text-[11px] font-semibold text-[#667a6d]">Hệ thống thám hiểm</p>
					</div>
				</div>

				{/* Navigation Menu */}
				<nav className="flex flex-col gap-1.5 pt-2">
					<p className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#88998d]">
						Camper Hub
					</p>
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = activeNav === item.key;
						return (
							<button
								key={item.key}
								type="button"
								onClick={() => onNavigate?.(item.key)}
								className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all ${
									isActive
										? "bg-[#164027] text-white shadow-md shadow-[#164027]/20"
										: "text-[#4a5e51] hover:bg-[#f4f7f2] hover:text-[#164027]"
								}`}
							>
								<Icon size={18} className={isActive ? "text-white" : "text-[#667a6d]"} />
								<span>{item.label}</span>
							</button>
						);
					})}
				</nav>
			</div>

			{/* User Mini Card at Bottom */}
			{profile && (
				<div className="flex flex-col gap-3 rounded-2xl border border-[#e0ebe0] bg-[#f8faf8] p-3.5">
					<div className="flex items-center gap-3">
						<img
							src={profile.avatarUrl}
							alt={profile.fullName}
							className="size-10 rounded-full object-cover ring-2 ring-[#164027]/20"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1">
								<h4 className="truncate font-bold text-[#10221b] text-sm">{profile.fullName}</h4>
							</div>
							<div className="flex items-center gap-1 text-[11px] font-semibold text-[#164027]">
								<Sparkles size={11} className="fill-[#164027]" />
								<span>Thành viên Pro</span>
							</div>
						</div>
					</div>
					<button
						type="button"
						className="flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] bg-white py-1.5 text-xs font-bold text-[#4a5e51] hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
					>
						<LogOut size={13} />
						<span>Đăng xuất</span>
					</button>
				</div>
			)}
		</aside>
	);
}
