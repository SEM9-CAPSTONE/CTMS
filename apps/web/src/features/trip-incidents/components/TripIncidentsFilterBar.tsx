import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { incidentCategoryLabels, incidentStatusLabels } from "../constants";
import type { IncidentCategory, IncidentStatus } from "../types";

export type IncidentStatusFilter = "all" | IncidentStatus;

export interface TripIncidentsFilterBarProps {
	search: string;
	statusFilter: IncidentStatusFilter;
	categoryFilter: "all" | IncidentCategory;
	statusCounts: Record<IncidentStatusFilter, number>;
	onSearchChange: (search: string) => void;
	onStatusFilterChange: (status: IncidentStatusFilter) => void;
	onCategoryFilterChange: (category: "all" | IncidentCategory) => void;
	onResetFilters: () => void;
}

const STATUS_TABS: Array<{ key: IncidentStatusFilter; label: string }> = [
	{ key: "all", label: "Tất cả" },
	{ key: "open", label: incidentStatusLabels.open },
	{ key: "investigating", label: incidentStatusLabels.investigating },
	{ key: "resolved", label: incidentStatusLabels.resolved },
	{ key: "closed", label: incidentStatusLabels.closed },
];

const CATEGORY_OPTIONS: Array<{ key: "all" | IncidentCategory; label: string }> = [
	{ key: "all", label: "Tất cả danh mục" },
	{ key: "injury", label: incidentCategoryLabels.injury },
	{ key: "illness", label: incidentCategoryLabels.illness },
	{ key: "equipment_failure", label: incidentCategoryLabels.equipment_failure },
	{ key: "weather_hazard", label: incidentCategoryLabels.weather_hazard },
	{ key: "lost_member", label: incidentCategoryLabels.lost_member },
	{ key: "route_obstruction", label: incidentCategoryLabels.route_obstruction },
	{ key: "wildlife", label: incidentCategoryLabels.wildlife },
	{ key: "other", label: incidentCategoryLabels.other },
];

export function TripIncidentsFilterBar({
	search,
	statusFilter,
	categoryFilter,
	statusCounts,
	onSearchChange,
	onStatusFilterChange,
	onCategoryFilterChange,
	onResetFilters,
}: TripIncidentsFilterBarProps): ReactNode {
	const hasActiveFilters =
		search.trim() !== "" || statusFilter !== "all" || categoryFilter !== "all";

	return (
		<div className="space-y-3 rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-xs">
			{/* Controls Row: Search + Category Select */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b8c82]" />
					<input
						type="text"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Tìm kiếm sự cố theo mô tả, người báo cáo..."
						className="w-full rounded-xl border border-[#dfe8df] bg-[#f8faf7] py-2 pl-9 pr-3 text-xs text-[#10221b] placeholder:text-[#8fa096] focus:border-[#164027] focus:bg-white focus:outline-none"
					/>
				</div>

				<div className="flex items-center gap-2">
					<select
						aria-label="Lọc theo danh mục"
						value={categoryFilter}
						onChange={(e) => onCategoryFilterChange(e.target.value as "all" | IncidentCategory)}
						className="rounded-xl border border-[#dfe8df] bg-[#f8faf7] px-3 py-2 text-xs font-semibold text-[#10221b] focus:border-[#164027] focus:outline-none"
					>
						{CATEGORY_OPTIONS.map((opt) => (
							<option key={opt.key} value={opt.key}>
								{opt.label}
							</option>
						))}
					</select>

					{hasActiveFilters && (
						<button
							type="button"
							onClick={onResetFilters}
							className="inline-flex items-center gap-1 rounded-xl border border-[#dfe8df] px-2.5 py-2 text-xs font-bold text-[#667a6d] hover:bg-[#f4f7f2]"
							title="Đặt lại bộ lọc"
						>
							<X className="size-3.5" />
							<span>Đặt lại</span>
						</button>
					)}
				</div>
			</div>

			{/* Status Tabs Row (DESIGN.md Section 4 pattern) */}
			<div className="flex flex-wrap items-center gap-2 border-t border-[#edf3ed] pt-3">
				<span className="mr-1 text-xs font-bold text-[#7b8c82]">Trạng thái:</span>
				{STATUS_TABS.map((tab) => {
					const isActive = statusFilter === tab.key;
					const count = statusCounts[tab.key] ?? 0;
					return (
						<button
							key={tab.key}
							type="button"
							onClick={() => onStatusFilterChange(tab.key)}
							className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
								isActive
									? "bg-[#164027] text-white shadow-sm shadow-[#164027]/20"
									: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7] hover:text-[#164027]"
							}`}
						>
							<span>{tab.label}</span>
							<span
								className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
									isActive ? "bg-white/20 text-white" : "bg-[#dfe8df] text-[#4a5e51]"
								}`}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
