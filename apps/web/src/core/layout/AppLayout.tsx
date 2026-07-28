import type React from "react";
import { useState } from "react";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export interface AppLayoutProps {
	children: React.ReactNode;
	user?: { fullName: string; email: string } | null;
	onNavigateToLogin?: () => void;
	onNavigateToRegister?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
	children,
	user,
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	const [sidebarOpen, setSidebarOpen] = useState(true);

	return (
		<div className="flex min-h-screen flex-col bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<AppHeader
				user={user}
				onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
				onNavigateToLogin={onNavigateToLogin}
				onNavigateToRegister={onNavigateToRegister}
			/>
			<div className="flex flex-1">
				<AppSidebar isOpen={sidebarOpen} />
				<main className="flex-1 p-6">{children}</main>
			</div>
			<AppFooter />
		</div>
	);
};
