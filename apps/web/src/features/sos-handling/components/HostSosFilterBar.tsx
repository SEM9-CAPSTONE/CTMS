import { Search } from "lucide-react";
import type React from "react";
import type { SosStatus } from "../types";

export type SosStatusFilter = "all" | SosStatus;

export interface HostSosFilterBarProps {
	statusFilter: SosStatusFilter;
	onStatusChange: (status: SosStatusFilter) => void;
	search: string;
	onSearchChange: (search: string) => void;
	counts?: {
		all: number;
		active: number;
		acknowledged: number;
		closed: number;
		cancelled: number;
	};
}

const TABS: Array<{ key: SosStatusFilter; label: string }> = [
	{ key: "all", label: "Tất cả" },
	{ key: "active", label: "Cần tiếp nhận" },
	{ key: "acknowledged", label: "Đang hỗ trợ" },
	{ key: "closed", label: "Đã giải quyết" },
	{ key: "cancelled", label: "Đã hủy" },
];

export function HostSosFilterBar({
	statusFilter,
	onStatusChange,
	search,
	onSearchChange,
	counts,
}: HostSosFilterBarProps) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			{/* Pill Tabs */}
			<div className="flex flex-wrap items-center gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 border border-[#dfe8df] shadow-xs">
				{TABS.map((tab) => {
					const isActive = statusFilter === tab.key;
					const count = counts ? counts[tab.key] : undefined;

					return (
						<button
							key={tab.key}
							type="button"
							onClick={() => onStatusChange(tab.key)}
							className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
								isActive
									? "bg-[#164027] text-white shadow-xs"
									: "text-[#55685a] hover:bg-[#f4f7f2] hover:text-[#164027]"
							}`}
						>
							<span>{tab.label}</span>
							{count !== undefined && count > 0 && (
								<span
									className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
										isActive
											? "bg-white/20 text-white"
											: tab.key === "active"
												? "bg-red-100 text-red-700"
												: "bg-[#edf2ee] text-[#627769]"
									}`}
								>
									{count}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Search input */}
			<div className="relative min-w-[240px] max-w-sm">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#889d90]" />
				<input
					type="text"
					value={search}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
					placeholder="Tìm theo camper, chuyến đi..."
					className="w-full rounded-xl border border-[#dfe8df] bg-white py-2 pr-3 pl-9 text-xs font-semibold text-[#10221b] placeholder-[#889d90] transition focus:border-[#164027] focus:outline-hidden focus:ring-1 focus:ring-[#164027]"
				/>
			</div>
		</div>
	);
}
