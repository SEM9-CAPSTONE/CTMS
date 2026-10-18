import { Calendar, ChevronDown, Filter, Search, Users } from "lucide-react";
import { type TripDetails, type TripStatus, formatTripStatus } from "../types";
import { formatDateRange } from "./TripCard";

export type TripFilterStatus = "all" | TripStatus;

export interface HostCampersTripSelectorProps {
	trips: TripDetails[];
	selectedTripId: string | null;
	onSelectTrip: (tripId: string) => void;
	statusFilter: TripFilterStatus;
	onStatusFilterChange: (status: TripFilterStatus) => void;
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	statusCounts: Record<string, number>;
}

const filterTabs: Array<{ key: TripFilterStatus; label: string }> = [
	{ key: "all", label: "Tất cả" },
	{ key: "published", label: "Đang mở bán" },
	{ key: "ongoing", label: "Đang diễn ra" },
	{ key: "completed", label: "Kết thúc" },
	{ key: "pending_approval", label: "Chờ duyệt" },
	{ key: "draft", label: "Bản nháp" },
	{ key: "cancelled", label: "Đã huỷ" },
];

const statusBadgeClasses: Record<TripStatus, string> = {
	draft: "bg-slate-100 text-slate-700 ring-slate-200",
	pending_approval: "bg-amber-50 text-amber-700 ring-amber-200",
	published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
	ongoing: "bg-sky-50 text-sky-700 ring-sky-200",
	completed: "bg-purple-50 text-purple-700 ring-purple-200",
	cancelled: "bg-red-50 text-red-700 ring-red-200",
	rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function HostCampersTripSelector({
	trips,
	selectedTripId,
	onSelectTrip,
	statusFilter,
	onStatusFilterChange,
	searchQuery,
	onSearchQueryChange,
	statusCounts,
}: HostCampersTripSelectorProps) {
	return (
		<div className="flex flex-col gap-4 rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm">
			<div>
				<h2 className="text-base font-extrabold text-[#10221b]">Chọn chuyến đi</h2>
			</div>

			{/* Search */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8fa096]" />
				<input
					type="text"
					placeholder="Tìm theo tên chuyến đi..."
					value={searchQuery}
					onChange={(e) => onSearchQueryChange(e.target.value)}
					className="w-full rounded-xl border border-[#cbd9cd] bg-[#f8faf8] py-2 pl-9 pr-3 text-xs font-medium text-[#10221b] placeholder:text-[#8fa096] focus:border-[#164027] focus:bg-white focus:outline-none"
				/>
			</div>

			{/* Status Filter Dropdown */}
			<div className="relative">
				<label htmlFor="trip-status-filter" className="sr-only">
					Lọc trạng thái chuyến đi
				</label>
				<div className="relative flex items-center">
					<Filter className="absolute left-3 size-3.5 text-[#8fa096] pointer-events-none" />
					<select
						id="trip-status-filter"
						aria-label="Lọc trạng thái chuyến đi"
						value={statusFilter}
						onChange={(e) => onStatusFilterChange(e.target.value as TripFilterStatus)}
						className="w-full appearance-none rounded-xl border border-[#cbd9cd] bg-[#f8faf8] py-2 pl-8.5 pr-8 text-xs font-bold text-[#10221b] focus:border-[#164027] focus:bg-white focus:outline-none transition cursor-pointer"
					>
						{filterTabs.map((tab) => {
							const count = statusCounts[tab.key] ?? 0;
							return (
								<option key={tab.key} value={tab.key}>
									{tab.label} ({count})
								</option>
							);
						})}
					</select>
					<ChevronDown className="absolute right-3 size-3.5 text-[#8fa096] pointer-events-none" />
				</div>
			</div>

			{/* Trip Items List */}
			<div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
				{trips.length === 0 ? (
					<p className="py-8 text-center text-xs text-[#667a6d]">
						Không tìm thấy chuyến đi nào phù hợp.
					</p>
				) : (
					trips.map((trip) => {
						const isSelected = selectedTripId === trip.id;
						const badgeClass = statusBadgeClasses[trip.status] ?? "bg-slate-100 text-slate-700";
						return (
							<button
								key={trip.id}
								type="button"
								onClick={() => onSelectTrip(trip.id)}
								aria-pressed={isSelected}
								className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
									isSelected
										? "border-[#164027] bg-[#edf5ee] shadow-xs ring-1 ring-[#164027]"
										: "border-[#e7eee7] bg-white hover:border-[#cbd9cd] hover:bg-[#f8faf8]"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<h3 className="line-clamp-2 text-xs font-extrabold text-[#10221b]">
										{trip.title}
									</h3>
									<span
										className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${badgeClass}`}
									>
										{formatTripStatus(trip.status)}
									</span>
								</div>

								<div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[#667a6d]">
									<span className="inline-flex items-center gap-1">
										<Calendar className="size-3 text-[#164027]" />
										{formatDateRange(trip.startsAt, trip.endsAt)}
									</span>
									<span className="inline-flex items-center gap-1">
										<Users className="size-3 text-[#164027]" />
										<strong className="font-bold text-[#10221b]">
											{trip.seatsTaken}/{trip.capacityMax ?? "-"}
										</strong>{" "}
										chỗ
									</span>
								</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
