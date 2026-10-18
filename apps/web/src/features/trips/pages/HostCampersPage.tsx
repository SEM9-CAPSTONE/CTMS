import { AlertCircle, Calendar, ExternalLink, Loader2, Plus, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import {
	HostCampersTripSelector,
	type TripFilterStatus,
} from "../components/HostCampersTripSelector";
import { HostTripBookingsView } from "../components/HostTripBookingsView";
import { formatDateRange, formatVND } from "../components/TripCard";
import { useMyTrips } from "../hooks/useMyTrips";
import { type TripStatus, formatTripStatus } from "../types";

export interface HostCampersPageProps {
	initialTripId?: string | null;
	onNavigateToTripDetail?: (tripId: string) => void;
	onCreateTrip?: () => void;
}

const statusBadgeClasses: Record<TripStatus, string> = {
	draft: "bg-slate-100 text-slate-700 ring-slate-200",
	pending_approval: "bg-amber-50 text-amber-700 ring-amber-200",
	published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
	ongoing: "bg-sky-50 text-sky-700 ring-sky-200",
	completed: "bg-purple-50 text-purple-700 ring-purple-200",
	cancelled: "bg-red-50 text-red-700 ring-red-200",
	rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function HostCampersPage({
	initialTripId,
	onNavigateToTripDetail,
	onCreateTrip,
}: HostCampersPageProps) {
	const { trips = [], isLoading, error, refetch } = useMyTrips();
	const [statusFilter, setStatusFilter] = useState<TripFilterStatus>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTripId, setSelectedTripId] = useState<string | null>(initialTripId ?? null);

	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = { all: trips.length };
		for (const trip of trips) {
			counts[trip.status] = (counts[trip.status] || 0) + 1;
		}
		return counts;
	}, [trips]);

	const filteredTrips = useMemo(() => {
		return trips.filter((t) => {
			const matchesStatus = statusFilter === "all" || t.status === statusFilter;
			const matchesSearch =
				!searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
			return matchesStatus && matchesSearch;
		});
	}, [trips, statusFilter, searchQuery]);

	// Auto-select initial or preferred trip
	useEffect(() => {
		if (trips.length === 0) return;

		if (selectedTripId && trips.some((t) => t.id === selectedTripId)) {
			return;
		}

		if (initialTripId && trips.some((t) => t.id === initialTripId)) {
			setSelectedTripId(initialTripId);
			return;
		}

		const preferred =
			filteredTrips.find((t) => t.status === "ongoing" || t.status === "published") ??
			filteredTrips[0] ??
			trips[0];
		if (preferred) {
			setSelectedTripId(preferred.id);
		}
	}, [trips, initialTripId, filteredTrips, selectedTripId]);

	const handleSelectTrip = (tripId: string) => {
		setSelectedTripId(tripId);
		const params = new URLSearchParams(window.location.search);
		params.set("tripId", tripId);
		window.history.replaceState({}, "", `${RoutePath.HOST_CAMPERS}?${params.toString()}`);
	};

	const selectedTrip = useMemo(
		() => trips.find((t) => t.id === selectedTripId) ?? null,
		[trips, selectedTripId]
	);

	if (isLoading && trips.length === 0) {
		return (
			<main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-6">
				<div className="flex items-center gap-3 rounded-3xl bg-white p-8 text-sm font-bold text-[#164027] shadow-sm">
					<Loader2 className="size-5 animate-spin" />
					<span>Đang tải danh sách chuyến đi...</span>
				</div>
			</main>
		);
	}

	if (error && trips.length === 0) {
		return (
			<main className="mx-auto max-w-7xl p-6">
				<div
					role="alert"
					className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 shadow-sm"
				>
					<AlertCircle className="mx-auto size-10 text-rose-700" />
					<h2 className="mt-3 text-lg font-extrabold text-[#10221b]">
						Không thể tải danh sách chuyến đi
					</h2>
					<p className="mt-1 text-xs text-rose-700">{error}</p>
					<Button variant="outline" size="sm" onClick={() => void refetch()} className="mt-5 gap-2">
						<RefreshCw className="size-4" />
						Thử lại
					</Button>
				</div>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
			{/* Page Header */}
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold text-[#10221b] sm:text-3xl">
						Người tham gia & đặt chỗ
					</h1>
				</div>
				<div className="flex flex-wrap items-center gap-2.5">
					<Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-2">
						<RefreshCw className="size-4" />
						Làm mới
					</Button>
					{onCreateTrip && (
						<Button
							size="sm"
							onClick={onCreateTrip}
							className="gap-1.5 bg-[#164027] text-white hover:bg-[#0f2e1c]"
						>
							<Plus className="size-4" />
							Tạo chuyến đi
						</Button>
					)}
				</div>
			</div>

			{trips.length === 0 ? (
				<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-12 text-center shadow-sm">
					<div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
						<Users className="size-7" />
					</div>
					<h2 className="mt-4 text-lg font-extrabold text-[#10221b]">Chưa có chuyến đi nào</h2>
					<p className="mx-auto mt-1 max-w-md text-xs text-[#667a6d]">
						Bạn chưa có chuyến đi nào để quản lý người tham gia và đơn đặt chỗ. Hãy tạo chuyến đi
						mới để bắt đầu nhận đơn.
					</p>
					{onCreateTrip && (
						<Button
							size="sm"
							onClick={onCreateTrip}
							className="mt-6 gap-1.5 bg-[#164027] text-white hover:bg-[#0f2e1c]"
						>
							<Plus className="size-4" />
							Tạo chuyến đi mới
						</Button>
					)}
				</section>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
					{/* Left: Trip Selector */}
					<div>
						<HostCampersTripSelector
							trips={filteredTrips}
							selectedTripId={selectedTripId}
							onSelectTrip={handleSelectTrip}
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
							searchQuery={searchQuery}
							onSearchQueryChange={setSearchQuery}
							statusCounts={statusCounts}
						/>
					</div>

					{/* Right: Selected Trip Info & Bookings Roster */}
					<div className="min-w-0 space-y-6">
						{selectedTrip ? (
							<>
								{/* Selected Trip Summary Card */}
								<section
									aria-label="Thông tin chuyến đi đã chọn"
									className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
								>
									<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span
													className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
														statusBadgeClasses[selectedTrip.status] ?? "bg-slate-100 text-slate-700"
													}`}
												>
													{formatTripStatus(selectedTrip.status)}
												</span>
												<span className="text-xs font-semibold text-[#667a6d]">
													Mã chuyến: {selectedTrip.id.slice(0, 8)}
												</span>
											</div>
											<h2 className="mt-2 text-xl font-extrabold text-[#10221b] sm:text-2xl">
												{selectedTrip.title}
											</h2>
											<div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-[#667a6d]">
												<span className="inline-flex items-center gap-1.5">
													<Calendar className="size-4 text-[#164027]" />
													{formatDateRange(selectedTrip.startsAt, selectedTrip.endsAt)}
												</span>
												<span className="inline-flex items-center gap-1.5">
													<Users className="size-4 text-[#164027]" />
													Số chỗ đã đặt:{" "}
													<strong className="font-bold text-[#10221b]">
														{selectedTrip.seatsTaken} / {selectedTrip.capacityMax ?? "-"}
													</strong>
												</span>
												{selectedTrip.pricePerPerson > 0 && (
													<span>
														Giá vé:{" "}
														<strong className="font-bold text-[#10221b]">
															{formatVND(selectedTrip.pricePerPerson)}/người
														</strong>
													</span>
												)}
											</div>
										</div>

										{onNavigateToTripDetail && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => onNavigateToTripDetail(selectedTrip.id)}
												className="gap-2 shrink-0"
											>
												<span>Xem chi tiết chuyến</span>
												<ExternalLink className="size-4" />
											</Button>
										)}
									</div>
								</section>

								{/* Draft / Pending notice */}
								{selectedTrip.status === "draft" || selectedTrip.status === "pending_approval" ? (
									<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-xs">
										<p className="font-bold">
											Chuyến đi này hiện ở trạng thái {formatTripStatus(selectedTrip.status)}.
										</p>
										<p className="mt-1 text-xs text-amber-800">
											Chuyến đi chưa được công bố hoặc mở bán. Danh sách người tham gia và đơn đặt
											chỗ sẽ khả dụng sau khi chuyến đi được xuất bản và campers bắt đầu đặt chỗ.
										</p>
									</div>
								) : (
									<HostTripBookingsView
										key={selectedTrip.id}
										tripId={selectedTrip.id}
										tripStatus={selectedTrip.status}
									/>
								)}
							</>
						) : (
							<div className="rounded-3xl border border-dashed border-[#dfe8df] bg-white p-12 text-center text-xs text-[#667a6d] shadow-sm">
								Vui lòng chọn một chuyến đi từ danh sách bên trái để xem người tham gia và đơn đặt
								chỗ.
							</div>
						)}
					</div>
				</div>
			)}
		</main>
	);
}
