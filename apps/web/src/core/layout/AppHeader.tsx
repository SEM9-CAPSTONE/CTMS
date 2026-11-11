import { Bell, Menu, User } from "lucide-react";
import type React from "react";
import { BRAND_LOGO_TEXT, BRAND_LOGO_URL } from "../assets";

export interface AppHeaderProps {
	onNavigateToLogin?: () => void;
	onNavigateToRegister?: () => void;
	onToggleSidebar?: () => void;
	user?: { fullName: string; email: string } | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
	onNavigateToLogin,
	onNavigateToRegister,
	onToggleSidebar,
	user,
}) => {
	return (
		<header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-emerald-950/10 bg-white/80 px-6 backdrop-blur-md">
			<div className="flex items-center gap-4">
				{onToggleSidebar && (
					<button
						type="button"
						onClick={onToggleSidebar}
						className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none"
						aria-label="Toggle Navigation Sidebar"
					>
						<Menu className="size-5" />
					</button>
				)}
				<div className="flex items-center gap-3 font-extrabold text-[#10221b]">
					<img src={BRAND_LOGO_URL} alt={BRAND_LOGO_TEXT} className="h-12 w-auto object-contain" />
					<span className="text-xl tracking-tight">{BRAND_LOGO_TEXT}</span>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{user ? (
					<div className="flex items-center gap-3">
						<button
							type="button"
							className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
							aria-label="Notifications"
						>
							<Bell className="size-5" />
						</button>
						<div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
							<User className="size-4 text-emerald-700" />
							<span>{user.fullName}</span>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onNavigateToLogin}
							className="rounded-xl px-4 py-2 text-sm font-semibold text-[#10221b] transition hover:bg-emerald-900/5"
						>
							Sign In
						</button>
						<button
							type="button"
							onClick={onNavigateToRegister}
							className="rounded-xl bg-[#2d5a27] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#23471e]"
						>
							Register
						</button>
					</div>
				)}
			</div>
		</header>
	);
};
