import { Check, Compass, Home, Tent } from "lucide-react";
import type React from "react";
import type { RoleOption } from "../types";

interface RoleSelectionCardProps {
	option: RoleOption;
	isSelected: boolean;
	onSelect: () => void;
}

export const RoleSelectionCard: React.FC<RoleSelectionCardProps> = ({
	option,
	isSelected,
	onSelect,
}) => {
	const renderIcon = () => {
		switch (option.id) {
			case "camper":
				return <Tent size={22} className="text-[#164027]" />;
			case "host":
				return <Home size={22} className="text-[#0284c7]" />;
			case "porter":
				return <Compass size={22} className="text-[#2563eb]" />;
			default:
				return <Tent size={22} className="text-[#164027]" />;
		}
	};

	const renderIconBg = () => {
		switch (option.id) {
			case "camper":
				return "bg-[#eef7f0]";
			case "host":
				return "bg-[#e0f2fe]";
			case "porter":
				return "bg-[#eff6ff]";
			default:
				return "bg-[#eef7f0]";
		}
	};

	const renderBadgeStyle = () => {
		if (!option.badge) return "";
		switch (option.badge.variant) {
			case "orange":
				return "bg-[#fff3e0] text-[#d97706]";
			case "green":
				return "bg-[#e8f5e9] text-[#164027]";
			default:
				return "bg-[#e8f5e9] text-[#164027]";
		}
	};

	return (
		<div
			onClick={onSelect}
			className={`group relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 ${
				isSelected
					? "border-[#164027] bg-[#f5f9f6] shadow-sm ring-1 ring-[#164027]/10"
					: "border-[#e0ebe0] bg-white hover:border-[#164027]/40 hover:bg-[#fafdfa]"
			}`}
		>
			<div className="flex items-start gap-4">
				{/* Left Icon */}
				<div
					className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${renderIconBg()}`}
				>
					{renderIcon()}
				</div>

				{/* Center Details */}
				<div className="flex-1">
					<div className="mb-1 flex flex-wrap items-center gap-2">
						<h3 className="text-base font-extrabold text-[#10221b]">{option.title}</h3>
						{option.badge && (
							<span
								className={`rounded px-2 py-0.5 text-[0.63rem] font-extrabold uppercase tracking-wider ${renderBadgeStyle()}`}
							>
								{option.badge.text}
							</span>
						)}
					</div>

					<p className="mb-2 text-xs font-medium text-[#425048]">{option.description}</p>

					<div className="flex flex-wrap gap-x-5 gap-y-1">
						{option.features.map((feat) => (
							<div
								key={feat}
								className="flex items-center gap-1.5 text-xs font-semibold text-[#1c442f]"
							>
								<Check size={13} className="shrink-0 text-[#164027]" />
								<span>{feat}</span>
							</div>
						))}
					</div>
				</div>

				{/* Right Radio Indicator */}
				<div
					className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-all ${
						isSelected ? "border-[#164027] bg-[#164027] text-white" : "border-[#cbd5e1] bg-white"
					}`}
				>
					{isSelected && <Check size={14} className="stroke-[3]" />}
				</div>
			</div>
		</div>
	);
};
