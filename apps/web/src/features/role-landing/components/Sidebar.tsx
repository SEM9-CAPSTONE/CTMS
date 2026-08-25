import { X } from "lucide-react";
import { LogoutActions } from "../../auth/components/LogoutActions";
import type { CamperProfileData } from "../../camper-profile/types";
import { roleLabels } from "../constants";
import type { DashboardConfig, RoleKey } from "../types";

export interface SidebarProps {
	config: DashboardConfig;
	grantedRoles: RoleKey[];
	activeRole: RoleKey;
	onRoleChange: (role: RoleKey) => void;
	onClose?: () => void;
	profile: CamperProfileData | null;
	onOpenProfile?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function Sidebar({
	config,
	grantedRoles,
	activeRole,
	onRoleChange,
	onClose,
	profile,
	onOpenProfile,
	onLogout,
}: SidebarProps) {
	return (
		<aside className="flex h-full w-72 flex-col border-r border-[#dfe8df] bg-white">
			<div className="flex items-center gap-3 border-b border-[#e7eee7] px-5 py-5">
				<img src="/ctms_logo.png" alt="CTMS Logo" className="h-10 w-auto shrink-0 object-contain" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<span className="text-base font-extrabold tracking-tight text-[#164027]">CTMS</span>
						<span
							className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
							style={{
								backgroundColor: `${config.accent}15`,
								color: config.accent,
							}}
						>
							{roleLabels[activeRole]}
						</span>
					</div>
					<p className="text-xs font-semibold text-[#667a6d]">{config.navTitle}</p>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng menu"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f1f5f0] lg:hidden"
					>
						<X className="size-5" />
					</button>
				)}
			</div>

			{grantedRoles.length > 1 && (
				<div className="border-b border-[#e7eee7] px-4 py-4">
					<p className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[#8fa096]">
						Vai trò hiện tại
					</p>
					<div className="mt-2 grid grid-cols-2 gap-1.5">
						{grantedRoles.map((role) => {
							const isCurrent = role === activeRole;
							return (
								<button
									key={role}
									type="button"
									onClick={() => onRoleChange(role)}
									className={`rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
										isCurrent
											? "bg-[#164027] text-white shadow-sm"
											: "bg-[#f8faf7] text-[#55685a] hover:bg-[#eef2ed]"
									}`}
								>
									{roleLabels[role]}
								</button>
							);
						})}
					</div>
				</div>
			)}

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<nav className="space-y-1" aria-label="Dashboard navigation">
					<p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#8fa096]">
						Menu chính
					</p>
					{config.navItems.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.key}
								type="button"
								disabled={item.disabled}
								className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#55685a] hover:bg-[#f8faf7] hover:text-[#164027] disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Icon className="size-5 shrink-0" />
								<span>{item.label}</span>
							</button>
						);
					})}
				</nav>
			</div>

			<div className="mt-auto border-t border-[#e7eee7] p-4">
				{profile && (
					<div
						className="mb-3 flex items-center gap-3 rounded-2xl border border-[#e0ebe0] bg-[#f8faf8] p-3 cursor-pointer hover:bg-[#f2f7f2] transition-colors"
						onClick={onOpenProfile}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								onOpenProfile?.();
							}
						}}
					>
						<img
							src={profile.avatarUrl}
							alt={profile.fullName}
							className="size-10 rounded-full object-cover ring-2 ring-[#164027]/20"
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-extrabold text-[#10221b]">{profile.fullName}</p>
							<p className="truncate text-[11px] font-semibold text-[#667a6d]">{profile.email}</p>
						</div>
					</div>
				)}
				{onLogout && <LogoutActions onLogout={onLogout} />}
			</div>
		</aside>
	);
}
