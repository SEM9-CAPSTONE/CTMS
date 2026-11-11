import { Bell, ChevronRight, Home, Search, Settings } from "lucide-react";
import type { CamperProfileData } from "../types";

interface CamperHeaderProps {
	profile: CamperProfileData | null;
	onBackHome?: () => void;
}

export function CamperHeader({ profile, onBackHome }: CamperHeaderProps) {
	return (
		<header className="flex flex-col gap-4 border-b border-[#dfe8df] bg-white px-8 py-6">
			{/* Top bar with Search & Action Icons */}
			<div className="flex items-center justify-between gap-4">
				{/* Breadcrumb */}
				<nav className="flex items-center gap-2 text-xs font-semibold text-[#667a6d]">
					<button
						type="button"
						onClick={onBackHome}
						className="flex items-center gap-1 hover:text-[#164027] transition"
					>
						<Home size={14} />
						<span>Trang chủ</span>
					</button>
					<ChevronRight size={13} className="text-[#a0b0a5]" />
					<span className="font-bold text-[#164027]">Hồ sơ & Cài đặt</span>
				</nav>

				{/* Right Utilities: Search & Notifications */}
				<div className="flex items-center gap-3">
					<div className="relative hidden sm:block">
						<Search
							size={15}
							className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#809486]"
						/>
						<input
							type="text"
							placeholder="Tìm kiếm cài đặt..."
							className="h-9 w-64 rounded-full border border-[#dfe8df] bg-[#f8faf8] pl-9 pr-4 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white focus:ring-2 focus:ring-[#164027]/10"
						/>
					</div>

					<button
						type="button"
						aria-label="Thông báo"
						className="relative flex size-9 items-center justify-center rounded-full border border-[#dfe8df] bg-white text-[#4a5e51] hover:bg-[#f4f7f2] hover:text-[#164027] transition"
					>
						<Bell size={16} />
						<span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
					</button>

					<button
						type="button"
						aria-label="Cài đặt hệ thống"
						className="flex size-9 items-center justify-center rounded-full border border-[#dfe8df] bg-white text-[#4a5e51] hover:bg-[#f4f7f2] hover:text-[#164027] transition"
					>
						<Settings size={16} />
					</button>

					{profile && (
						<img
							src={profile.avatarUrl}
							alt={profile.fullName}
							className="size-9 rounded-full object-cover ring-2 ring-[#164027]/30"
						/>
					)}
				</div>
			</div>

			{/* Main Title & Live Sync Badge */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#164027]">
							Hồ sơ & Cài đặt
						</h1>
						<span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#164027] border border-[#d6ebd9]">
							<span className="relative flex size-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
								<span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
							</span>
							Đã kết nối trực tiếp
						</span>
					</div>
					<p className="mt-1 text-xs sm:text-sm font-medium text-[#5c7063]">
						Quản lý thông tin cá nhân, an toàn, thông báo và tài khoản của bạn để đảm bảo trải
						nghiệm thám hiểm tốt nhất.
					</p>
				</div>
			</div>
		</header>
	);
}
