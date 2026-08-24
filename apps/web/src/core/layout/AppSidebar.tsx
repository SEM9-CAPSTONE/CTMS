import { Home, LifeBuoy, Map as MapIcon, Settings, ShieldAlert, Tent } from "lucide-react";
import type React from "react";

export interface AppSidebarProps {
	isOpen: boolean;
	onClose?: () => void;
	activeRoute?: string;
	onNavigate?: (path: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
	isOpen,
	onNavigate,
	activeRoute = "/",
}) => {
	if (!isOpen) return null;

	const navItems = [
		{ label: "Dashboard", icon: Home, path: "/dashboard" },
		{ label: "Khu cắm trại", icon: Tent, path: "/campsites" },
		{ label: "Trekking Routes", icon: MapIcon, path: "/trekking" },
		{ label: "Safety Center", icon: ShieldAlert, path: "/safety" },
		{ label: "AI Survival", icon: LifeBuoy, path: "/ai-assistant" },
		{ label: "Settings", icon: Settings, path: "/settings" },
	];

	return (
		<aside className="w-64 border-r border-gray-200 bg-white p-4">
			<nav className="flex flex-col gap-1">
				{navItems.map((item) => {
					const Icon = item.icon;
					const isActive = activeRoute === item.path;
					return (
						<button
							key={item.path}
							type="button"
							onClick={() => onNavigate?.(item.path)}
							className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
								isActive
									? "bg-[#e8f0e6] text-[#2d5a27]"
									: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							}`}
						>
							<Icon className="size-4" />
							<span>{item.label}</span>
						</button>
					);
				})}
			</nav>
		</aside>
	);
};
