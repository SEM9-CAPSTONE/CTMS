import {
	Backpack,
	Bell,
	HeartPulse,
	KeyRound,
	Lock,
	type LucideIcon,
	PhoneCall,
	ShieldAlert,
	User,
} from "lucide-react";
import { SETTINGS_TABS } from "../constants";
import type { SettingsTabEnum } from "../enums/settings-tab.enum";
import type { SettingsTabConfig } from "../types";

interface SettingsSubNavProps {
	activeTab: SettingsTabEnum;
	onTabChange: (tab: SettingsTabEnum) => void;
}

const iconMap: Record<string, LucideIcon> = {
	User,
	PhoneCall,
	ShieldAlert,
	HeartPulse,
	Backpack,
	Bell,
	Lock,
	KeyRound,
};

export function SettingsSubNav({ activeTab, onTabChange }: SettingsSubNavProps) {
	return (
		<div className="flex w-full md:w-64 shrink-0 flex-col gap-1 rounded-2xl border border-[#e0ebe0] bg-white p-2.5 shadow-sm">
			<div className="px-3 py-2">
				<p className="text-[11px] font-extrabold uppercase tracking-wider text-[#88998d]">
					Danh mục cài đặt
				</p>
			</div>

			{SETTINGS_TABS.map((tab: SettingsTabConfig) => {
				const Icon = iconMap[tab.iconName] || User;
				const isActive = activeTab === tab.key;

				return (
					<button
						key={tab.key}
						type="button"
						onClick={() => onTabChange(tab.key)}
						className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
							isActive
								? "bg-[#eef7f0] text-[#164027] ring-1 ring-[#164027]/20 shadow-xs"
								: "text-[#4a5e51] hover:bg-[#f4f7f2] hover:text-[#164027]"
						}`}
					>
						<div className="flex items-center gap-3">
							<Icon size={16} className={isActive ? "text-[#164027]" : "text-[#788c7e]"} />
							<span>{tab.label}</span>
						</div>

						{tab.badgeCount && (
							<span className="flex size-5 items-center justify-center rounded-full bg-amber-100 font-extrabold text-[10px] text-amber-800">
								{tab.badgeCount}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
