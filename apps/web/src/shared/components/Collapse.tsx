import { ChevronLeft } from "lucide-react";
import type React from "react";

export interface CollapseProps {
	children: React.ReactNode;
	isCollapsed: boolean;
	onToggle: () => void;
	widthClass?: string; // e.g. "w-72" or "w-64"
	className?: string;
	buttonClassName?: string;
}

export const Collapse: React.FC<CollapseProps> = ({
	children,
	isCollapsed,
	onToggle,
	widthClass = "w-72",
	className = "",
	buttonClassName = "",
}) => {
	return (
		<div
			className={`relative transition-all duration-300 ease-in-out shrink-0 h-full ${
				isCollapsed ? "w-0" : widthClass
			} ${className}`}
		>
			{/* Sidebar Content Wrapper: prevents content squishing/shrinking during transitions */}
			<div
				className={`h-full transition-transform duration-300 ease-in-out ${widthClass} ${
					isCollapsed ? "-translate-x-full" : "translate-x-0"
				}`}
			>
				{children}
			</div>

			{/* Floating Toggle Button (Visible only on desktop screens) */}
			<button
				type="button"
				onClick={onToggle}
				className={`sidebar-edge-toggle hidden lg:grid ${
					isCollapsed ? "left-4 rotate-180" : "left-[calc(100%-12px)]"
				} ${buttonClassName}`}
				aria-label={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
			>
				<ChevronLeft aria-hidden="true" className="size-3.5" />
			</button>
		</div>
	);
};
