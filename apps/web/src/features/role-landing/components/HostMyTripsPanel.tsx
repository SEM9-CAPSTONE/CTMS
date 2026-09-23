import {
	AlertCircle,
	Calendar,
	CalendarDays,
	CalendarPlus,
	ChevronLeft,
	ChevronRight,
	Compass,
	Eye,
	Filter,
	Loader2,
	MapPinned,
	Mountain,
	RefreshCw,
	Route,
	Users,
	Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { useMyTrips } from "../../trips/hooks/useMyTrips";
import type { TripStatus } from "../../trips/types";

export interface HostMyTripsPanelProps {
	onCreateTrip?: () => void;
	onCreateTrekkingRoute?: () => void;
	onViewTrekkingRoutes?: () => void;
	onViewEquipmentCatalog?: () => void;
	onNavigateToTripDetail?: (tripId: string) => void;
}

const statusLabels: Record<TripStatus, { label: string; className: string }> = {
	draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700 ring-slate-200" },
	pending_approval: {
		label: "Chờ duyệt",
		className: "bg-amber-50 text-amber-700 ring-amber-200",
	},
	published: { label: "Đang mở bán", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
	ongoing: { label: "Đang diễn ra", className: "bg-sky-50 text-sky-700 ring-sky-200" },
	completed: { label: "Đã hoàn thành", className: "bg-purple-50 text-purple-700 ring-purple-200" },
	cancelled: { label: "Đã huỷ", className: "bg-red-50 text-red-700 ring-red-200" },
};

const filterTabs: Array<{ key: "all" | TripStatus; label: string }> = [
	{ key: "all", label: "Tất cả" },
	{ key: "published", label: "Đang mở bán" },
	{ key: "pending_approval", label: "Chờ duyệt" },
	{ key: "draft", label: "Bản nháp" },
	{ key: "ongoing", label: "Đang diễn ra" },
	{ key: "completed", label: "Đã hoàn thành" },
	{ key: "cancelled", label: "Đã huỷ" },
];

function formatDateRange(startsAt: string, endsAt: string): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	const startStr = start.toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	const endStr = end.toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	if (startStr === endStr) return startStr;
	return `${startStr} – ${endStr}`;
}

export function HostMyTripsPanel({
	onCreateTrip,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onViewEquipmentCatalog,
	onNavigateToTripDetail,
}: HostMyTripsPanelProps) {
	const { trips, isLoading, error, refetch } = useMyTrips();
	const [selectedStatus, setSelectedStatus] = useState<"all" | TripStatus>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(4);

	// Count trips by status
	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = { all: trips.length };
		for (const trip of trips) {
			counts[trip.status] = (counts[trip.status] || 0) + 1;
		}
		return counts;
	}, [trips]);

	// Filtered trips
	const filteredTrips = useMemo(() => {
		if (selectedStatus === "all") return trips;
		return trips.filter((t) => t.status === selectedStatus);
	}, [trips, selectedStatus]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));
	const paginatedTrips = useMemo(() => {
		const startIndex = (currentPage - 1) * pageSize;
		return filteredTrips.slice(startIndex, startIndex + pageSize);
	}, [filteredTrips, currentPage, pageSize]);

	const handleStatusChange = (status: "all" | TripStatus) => {
		setSelectedStatus(status);
		setCurrentPage(1);
	};

	const handlePageChange = (newPage: number) => {
		if (newPage >= 1 && newPage <= totalPages) {
			setCurrentPage(newPage);
		}
	};

	return (
		<section
			id="host-my-trips"
			aria-label="Danh sách chuyến đi của Host"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			{/* Top Action Toolbar (Merged with Quick Tasks) */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex items-center gap-3.5">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-[#164027] text-white shadow-md shadow-[#164027]/15">
						<Compass className="size-6" />
					</div>
					<div>
						<div className="flex items-center gap-2.5">
							<h2 className="text-xl font-extrabold tracking-tight text-[#10221b]">
								Chuyến đi của bạn
							</h2>
							<span className="rounded-full bg-[#eef7f0] px-2.5 py-0.5 text-xs font-bold text-[#164027]">
								{trips.length} chuyến
							</span>
						</div>
						<p className="mt-0.5 text-xs font-medium text-[#667a6d]">
							Khởi tạo, theo dõi tình trạng duyệt, mở bán và điều phối các chuyến đi của bạn.
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{onCreateTrip && (
						<Button
							type="button"
							onClick={onCreateTrip}
							className="gap-2 bg-[#164027] text-xs font-bold text-white hover:bg-[#123520]"
						>
							<CalendarPlus className="size-4" />
							<span>Tạo trip</span>
						</Button>
					)}
					{onCreateTrekkingRoute && (
						<Button
							type="button"
							variant="outline"
							onClick={onCreateTrekkingRoute}
							className="gap-2 text-xs font-bold"
						>
							<Route className="size-4" />
							<span>Tạo tuyến trekking</span>
						</Button>
					)}
					{onViewTrekkingRoutes && (
						<Button
							type="button"
							variant="outline"
							onClick={onViewTrekkingRoutes}
							className="gap-2 text-xs font-bold"
						>
							<MapPinned className="size-4" />
							<span>Quản lý tuyến</span>
						</Button>
					)}
					{onViewEquipmentCatalog && (
						<Button
							type="button"
							variant="outline"
							onClick={onViewEquipmentCatalog}
							className="gap-2 text-xs font-bold"
						>
							<Warehouse className="size-4" />
							<span>Quản lý kho thiết bị</span>
						</Button>
					)}
				</div>
			</div>

			{/* Status Filter Bar */}
			{!isLoading && !error && trips.length > 0 && (
				<div className="mt-5 flex flex-wrap items-center gap-2 border-y border-[#edf3ee] py-3">
					<div className="mr-1 flex items-center gap-1.5 text-xs font-bold text-[#7b8c82]">
						<Filter className="size-3.5" />
						<span>Lọc trạng thái:</span>
					</div>
					{filterTabs.map((tab) => {
						const count = statusCounts[tab.key] || 0;
						const isActive = selectedStatus === tab.key;
						if (tab.key !== "all" && count === 0) return null;

						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => handleStatusChange(tab.key)}
								className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
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
			)}

			<div className="mt-6">
				{isLoading && (
					<div className="flex flex-col items-center justify-center gap-3 py-12 text-[#667a6d]">
						<Loader2 className="size-8 animate-spin text-[#164027]" />
						<p className="text-sm font-semibold">Đang tải danh sách chuyến đi của bạn...</p>
					</div>
				)}

				{!isLoading && error && (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
						<div className="flex items-center gap-3">
							<AlertCircle className="size-5 shrink-0 text-red-600" />
							<p className="flex-1 text-sm font-bold">{error}</p>
							<Button
								type="button"
								variant="outline"
								onClick={() => void refetch()}
								className="gap-1.5 border-red-300 text-xs text-red-800 hover:bg-red-100"
							>
								<RefreshCw className="size-3.5" />
								<span>Thử lại</span>
							</Button>
						</div>
					</div>
				)}

				{!isLoading && !error && trips.length === 0 && (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d2ded3] bg-[#fbfdfb] py-12 text-center">
						<div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#164027]">
							<CalendarDays className="size-7" />
						</div>
						<h3 className="mt-4 text-base font-extrabold text-[#10221b]">
							Chưa có chuyến đi nào được tạo
						</h3>
						<p className="mt-1 max-w-sm text-xs text-[#667a6d]">
							Hãy bắt đầu tạo chuyến đi trekking đầu tiên từ các tuyến trekking đã được duyệt của
							bạn.
						</p>
						{onCreateTrip && (
							<Button
								type="button"
								onClick={onCreateTrip}
								className="mt-4 gap-2 bg-[#164027] text-xs font-bold text-white"
							>
								<CalendarPlus className="size-4" />
								<span>Tạo trip ngay</span>
							</Button>
						)}
					</div>
				)}

				{!isLoading && !error && trips.length > 0 && filteredTrips.length === 0 && (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe8df] bg-[#fbfdfb] py-10 text-center">
						<p className="text-sm font-bold text-[#55685a]">
							Không có chuyến đi nào ở trạng thái này.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleStatusChange("all")}
							className="mt-3 text-xs"
						>
							Xem tất cả chuyến đi ({trips.length})
						</Button>
					</div>
				)}

				{!isLoading && !error && paginatedTrips.length > 0 && (
					<>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{paginatedTrips.map((trip) => {
								const statusCfg = statusLabels[trip.status] ?? statusLabels.draft;
								return (
									<article
										key={trip.id}
										className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] transition-all hover:-translate-y-1 hover:border-[#b8cfbc] hover:shadow-md"
									>
										<div className="relative aspect-[16/9] w-full overflow-hidden bg-[#e8efe9]">
											{trip.coverImageUrl ? (
												<img
													src={trip.coverImageUrl}
													alt={trip.title}
													className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
												/>
											) : (
												<div className="flex size-full items-center justify-center text-[#7b8c82]">
													<Mountain className="size-10 opacity-40" />
												</div>
											)}
											<div className="absolute top-2.5 left-2.5">
												<span
													className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${statusCfg.className}`}
												>
													{statusCfg.label}
												</span>
											</div>
										</div>

										<div className="flex flex-1 flex-col p-4">
											<h4
												title={trip.title}
												className="line-clamp-2 text-sm font-extrabold text-[#10221b] group-hover:text-[#164027]"
											>
												{trip.title}
											</h4>

											<div className="mt-3 space-y-1.5 text-xs text-[#55685a]">
												<div className="flex items-center gap-2">
													<Calendar className="size-3.5 shrink-0 text-[#8fa096]" />
													<span className="truncate">
														{formatDateRange(trip.startsAt, trip.endsAt)}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<Users className="size-3.5 shrink-0 text-[#8fa096]" />
													<span>
														{trip.seatsTaken} / {trip.capacityMax ?? "Không giới hạn"} chỗ
													</span>
												</div>
											</div>

											<div className="mt-4 flex items-center justify-between border-t border-[#edf3ee] pt-3">
												<div>
													<p className="text-[10px] font-bold uppercase tracking-wider text-[#8fa096]">
														Giá vé
													</p>
													<p className="text-sm font-extrabold text-[#164027]">
														{trip.pricePerPerson.toLocaleString("vi-VN")} đ
													</p>
												</div>

												{onNavigateToTripDetail && (
													<button
														type="button"
														onClick={() => onNavigateToTripDetail(trip.id)}
														className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#164027] ring-1 ring-[#cbd9ce] hover:bg-[#164027] hover:text-white transition-colors"
													>
														<Eye className="size-3.5" />
														<span>Chi tiết</span>
													</button>
												)}
											</div>
										</div>
									</article>
								);
							})}
						</div>

						{/* Pagination Controls */}
						<div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#edf3ee] pt-4 sm:flex-row">
							<div className="flex items-center gap-3 text-xs font-bold text-[#667a6d]">
								<span>
									Trang {currentPage} / {totalPages} (Tổng cộng {filteredTrips.length} chuyến đi)
								</span>
								<div className="flex items-center gap-1">
									<span className="text-[#8fa096]">Hiển thị:</span>
									{[4, 8, 12].map((size) => (
										<button
											key={size}
											type="button"
											onClick={() => {
												setPageSize(size);
												setCurrentPage(1);
											}}
											className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
												pageSize === size
													? "bg-[#164027] text-white"
													: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]"
											}`}
										>
											{size}
										</button>
									))}
								</div>
							</div>

							<div className="flex items-center gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={currentPage <= 1}
									onClick={() => handlePageChange(currentPage - 1)}
									className="gap-1 text-xs"
								>
									<ChevronLeft className="size-4" />
									<span>Trước</span>
								</Button>

								<div className="flex items-center gap-1">
									{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
										<button
											key={pageNum}
											type="button"
											onClick={() => handlePageChange(pageNum)}
											className={`flex size-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
												currentPage === pageNum
													? "bg-[#164027] text-white shadow-sm shadow-[#164027]/20"
													: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2]"
											}`}
										>
											{pageNum}
										</button>
									))}
								</div>

								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={currentPage >= totalPages}
									onClick={() => handlePageChange(currentPage + 1)}
									className="gap-1 text-xs"
								>
									<span>Sau</span>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
