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
				className={`absolute top-6 z-40 hidden lg:flex size-6 items-center justify-center rounded-full border border-[#dfe8df] bg-white text-[#164027] shadow-md transition-all duration-300 hover:bg-[#f1f5f0] hover:scale-105 active:scale-95 ${
					isCollapsed ? "left-4 rotate-180" : "left-[calc(100%-12px)]"
				} ${buttonClassName}`}
				aria-label={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
			>
				<ChevronLeft className="size-3.5" />
			</button>
		</div>
	);
};
