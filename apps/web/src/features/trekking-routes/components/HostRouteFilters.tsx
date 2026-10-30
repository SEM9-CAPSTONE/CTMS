import { ArrowDownUp, Search } from "lucide-react";
import type { RouteSort, RouteStatusCounts, RouteStatusFilter } from "../types";

interface Props {
	status: RouteStatusFilter;
	counts?: RouteStatusCounts;
	search: string;
	sort: RouteSort;
	onStatusChange: (status: RouteStatusFilter) => void;
	onSearchChange: (value: string) => void;
	onSortChange: (value: RouteSort) => void;
}
const filters: Array<{ value: RouteStatusFilter; label: string }> = [
	{ value: "all", label: "Tất cả" },
	{ value: "draft", label: "Nháp" },
	{ value: "pending_approval", label: "Chờ duyệt" },
	{ value: "active", label: "Đang hoạt động" },
	{ value: "closed", label: "Đã đóng" },
];
export function HostRouteFilters({
	status,
	counts,
	search,
	sort,
	onStatusChange,
	onSearchChange,
	onSortChange,
}: Props) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#e1e7e3] bg-white px-4 py-3 lg:px-5">
			<fieldset aria-label="Lọc trạng thái tuyến" className="flex min-w-0 flex-wrap gap-2">
				{filters.map((filter) => (
					<button
						key={filter.value}
						type="button"
						aria-label={filter.label}
						aria-pressed={status === filter.value}
						onClick={() => onStatusChange(filter.value)}
						className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${status === filter.value ? "border-[#387757] bg-[#eff8f2] text-[#164d32]" : "border-[#dfe6e0] bg-white text-[#34483b] hover:bg-[#f5f8f5]"}`}
					>
						{filter.label}
						<span
							aria-hidden="true"
							className={`rounded-full px-1.5 py-0.5 text-[11px] ${status === filter.value ? "bg-[#d7ecdf]" : "bg-[#f0f2f1] text-[#667a6d]"}`}
						>
							{counts?.[filter.value] ?? "—"}
						</span>
					</button>
				))}
			</fieldset>
			<div className="flex w-full items-center gap-3 sm:w-auto">
				<label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fcfdfc] px-3 py-2.5 text-[#667a6d] sm:w-56">
					<Search className="size-4 shrink-0" />
					<span className="sr-only">Tìm tuyến</span>
					<input
						aria-label="Tìm tuyến"
						placeholder="Tìm tên tuyến..."
						maxLength={150}
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						className="w-full min-w-0 bg-transparent text-sm text-[#10221b] outline-none"
					/>
				</label>
				<label className="flex shrink-0 items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fcfdfc] px-3 py-2.5">
					<ArrowDownUp className="size-4 text-[#667a6d]" />
					<span className="sr-only">Sắp xếp tuyến</span>
					<select
						aria-label="Sắp xếp tuyến"
						value={sort}
						onChange={(event) => onSortChange(event.target.value as RouteSort)}
						className="max-w-32 bg-transparent text-sm font-semibold text-[#34483b] outline-none"
					>
						<option value="newest">Mới nhất</option>
						<option value="oldest">Cũ nhất</option>
						<option value="name">Tên A–Z</option>
					</select>
				</label>
			</div>
		</div>
	);
}
