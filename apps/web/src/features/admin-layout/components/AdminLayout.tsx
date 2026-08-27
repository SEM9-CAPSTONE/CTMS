import { Menu } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type AdminNavigationItem, AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
	activeItem: AdminNavigationItem;
	children: React.ReactNode;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminLayout({ activeItem, children, onLogout }: AdminLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<AdminSidebar
				activeItem={activeItem}
				onLogout={onLogout}
				className="fixed inset-y-0 left-0 z-30 hidden lg:flex"
			/>

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
						onLogout={onLogout}
						onClose={() => setMobileMenuOpen(false)}
						className="relative z-10 shadow-2xl"
					/>
				</div>
			)}

			<div className="min-h-screen lg:pl-72">
				<header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#dfe8df] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label="Open administration menu"
						className="rounded-xl border border-[#dfe8df] p-2.5 text-[#164027] transition hover:bg-[#f1f5f0]"
					>
						<Menu className="size-5" />
					</button>
					<div className="flex items-center gap-2.5">
						<img src="/ctms_logo.png" alt="CTMS Logo" className="h-8 w-auto object-contain" />
						<p className="font-extrabold text-[#10221b]">Quản trị CTMS</p>
					</div>
				</header>

				<main>{children}</main>
			</div>
		</div>
	);
}
