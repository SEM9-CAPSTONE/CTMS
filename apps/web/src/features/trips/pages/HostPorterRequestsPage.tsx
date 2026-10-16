import {
	AlertTriangle,
	BriefcaseBusiness,
	CalendarDays,
	CheckCircle2,
	ChevronRight,
	Loader2,
	RefreshCw,
	Search,
	UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { AvailablePortersPanel } from "../components/AvailablePortersPanel";
import { PorterRequestCard } from "../components/PorterRequestCard";
import { formatDateRange } from "../components/TripCard";
import { useHostPorterAssignments } from "../hooks/useHostPorterAssignments";
import { usePorterCandidateTrips } from "../hooks/usePorterCandidateTrips";
import {
	responseErrorMessage,
	useAllHostPorterRequests,
	useCancelPorterRequest,
} from "../hooks/usePorterRequests";
import {
	type HostPorterAssignmentTrip,
	type PorterRequest,
	type TripDetails,
	type TripPorterAssignmentStatus,
	formatTripStatus,
} from "../types";

type PorterTab = "find" | "requests" | "assigned";
type AssignmentTripTiming = "upcoming" | "ongoing" | "ended";
type AssignmentTripFilter = "all" | AssignmentTripTiming;

interface HostPorterRequestsPageProps {
	initialTripId?: string | null;
	initialView?: string | null;
}

function normalizeView(value?: string | null): PorterTab {
	return value === "requests" || value === "assigned" ? value : "find";
}

function syncSelectedTripToUrl(tripId: string, view: PorterTab) {
	const params = new URLSearchParams({ view });
	if (tripId) params.set("tripId", tripId);
	const nextUrl = `/host/porter?${params.toString()}`;
	window.history.replaceState({}, "", nextUrl);
}

function getTripOptionLabel(
	trip: Pick<TripDetails, "title" | "status" | "startsAt" | "endsAt">
): string {
	return trip.title;
}

function EmptyFutureTab({ title }: { title: string }) {
	return (
		<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-8 text-center shadow-sm">
			<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
				<BriefcaseBusiness className="size-6" />
			</div>
			<h2 className="mt-4 text-lg font-extrabold text-[#10221b]">{title}</h2>
		</section>
	);
}

type HostRequestFilter = "pending" | "accepted" | "declined";

const hostRequestFilters: Array<{
	value: HostRequestFilter;
	label: string;
}> = [
	{ value: "pending", label: "Đang chờ" },
	{ value: "accepted", label: "Đã chấp nhận" },
	{ value: "declined", label: "Đã từ chối" },
];

function HostRequestList() {
	const query = useAllHostPorterRequests();
	const cancelMutation = useCancelPorterRequest();
	const submitting = useRef(false);
	const [cancelRequest, setCancelRequest] = useState<PorterRequest | null>(null);
	const [statusFilter, setStatusFilter] = useState<HostRequestFilter>("pending");
	const requests = query.data ?? [];
	const filteredRequests = requests.filter((request) => request.status === statusFilter);
	const error = query.error ? responseErrorMessage(query.error) : null;
	const mutationError = cancelMutation.error ? responseErrorMessage(cancelMutation.error) : null;
	const showInitialLoading = query.isLoading && requests.length === 0;
	useEffect(() => {
		if (!cancelRequest || cancelMutation.isPending || !query.data) return;
		const current = query.data.find((item) => item.id === cancelRequest.id);
		if (!current || current.status !== "pending") setCancelRequest(null);
	}, [cancelRequest, cancelMutation.isPending, query.data]);

	const confirmCancel = async () => {
		if (!cancelRequest || submitting.current) return;
		submitting.current = true;
		try {
			await cancelMutation.mutateAsync({
				tripId: cancelRequest.tripId,
				requestId: cancelRequest.id,
			});
			setCancelRequest(null);
		} catch {
			// Keep recoverable errors visible in the confirmation modal.
		} finally {
			submitting.current = false;
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap gap-2" aria-label="Lọc trạng thái yêu cầu">
					{hostRequestFilters.map((filter) => (
						<button
							key={filter.value}
							type="button"
							onClick={() => setStatusFilter(filter.value)}
							className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
								statusFilter === filter.value
									? "bg-[#164027] text-white"
									: "border border-[#cbd9cd] bg-white text-[#55685a] hover:bg-[#f1f5f0]"
							}`}
						>
							{filter.label}
						</button>
					))}
				</div>
				<Button variant="outline" size="sm" onClick={() => void query.refetch()} className="gap-2">
					<RefreshCw className="size-4" />
					Tải lại
				</Button>
			</div>
			{showInitialLoading && (
				<div className="flex items-center justify-center gap-3 rounded-3xl border border-[#dfe8df] bg-white p-8 text-sm font-bold text-[#667a6d]">
					<Loader2 className="size-5 animate-spin text-[#164027]" />
					Đang tải yêu cầu...
				</div>
			)}
			{!showInitialLoading && error && (
				<div
					role="alert"
					className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-900"
				>
					{error}
				</div>
			)}
			{mutationError && !cancelRequest && (
				<div
					role="alert"
					className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900"
				>
					{mutationError}
				</div>
			)}
			{!showInitialLoading && !error && filteredRequests.length === 0 && (
				<div className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-8 text-center text-sm font-bold text-[#667a6d]">
					Không có yêu cầu ở trạng thái này.
				</div>
			)}
			{filteredRequests.length > 0 && (
				<ul className="space-y-3">
					{filteredRequests.map((request) => (
						<PorterRequestCard
							key={request.id}
							request={request}
							mode="host"
							onCancel={(request) => {
								cancelMutation.reset();
								setCancelRequest(request);
							}}
							isSubmitting={
								cancelMutation.isPending && cancelMutation.variables?.requestId === request.id
							}
						/>
					))}
				</ul>
			)}
			<ConfirmModal
				isOpen={cancelRequest !== null}
				onClose={() => {
					if (!cancelMutation.isPending) setCancelRequest(null);
				}}
				onConfirm={confirmCancel}
				title="Hủy yêu cầu Porter?"
				description={
					<div className="space-y-3">
						<p>
							Yêu cầu đang chờ sẽ chuyển sang trạng thái đã hủy. Nếu Porter đã được phân công, thao
							tác này không thay đổi phân công.
						</p>
						{mutationError && (
							<p role="alert" className="text-rose-800">
								{mutationError}
							</p>
						)}
					</div>
				}
				confirmText="Hủy yêu cầu"
				variant="warning"
				isLoading={cancelMutation.isPending}
			/>
		</section>
	);
}

const assignmentStatusLabels: Record<TripPorterAssignmentStatus, string> = {
	assigned: "Đang được phân công",
	pending_reconfirmation: "Chờ xác nhận lại",
	unassigned: "Đã ngừng phân công",
};

const assignmentTripFilters: Array<{
	value: AssignmentTripFilter;
	label: string;
}> = [
	{ value: "all", label: "Tất cả" },
	{ value: "upcoming", label: "Sắp diễn ra" },
	{ value: "ongoing", label: "Đang diễn ra" },
	{ value: "ended", label: "Đã kết thúc" },
];

const assignmentTripTimingMeta: Record<AssignmentTripTiming, { label: string; className: string }> =
	{
		upcoming: {
			label: "Sắp diễn ra",
			className: "bg-emerald-50 text-emerald-700",
		},
		ongoing: {
			label: "Đang diễn ra",
			className: "bg-amber-50 text-amber-700",
		},
		ended: {
			label: "Đã kết thúc",
			className: "bg-slate-100 text-slate-600",
		},
	};

function getAssignmentTripTiming(
	trip: Pick<HostPorterAssignmentTrip, "startsAt" | "endsAt">
): AssignmentTripTiming {
	const now = Date.now();
	if (now < new Date(trip.startsAt).getTime()) return "upcoming";
	if (now <= new Date(trip.endsAt).getTime()) return "ongoing";
	return "ended";
}

function formatAssignmentTime(value: string | null): string {
	if (!value) return "Chưa có dữ liệu";
	return new Date(value).toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatAssignmentTripTimeRange(startsAt: string, endsAt: string): string {
	const format = (value: string) =>
		new Date(value).toLocaleString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

	return `${format(startsAt)} - ${format(endsAt)}`;
}

function formatAssignmentTripDateRange(startsAt: string, endsAt: string): string {
	const start = new Date(startsAt).toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
	});
	const end = new Date(endsAt).toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	return `${start} - ${end}`;
}

function HostAssignedPortersList({ trip }: { trip: HostPorterAssignmentTrip }) {
	const canFindReplacement =
		trip.status === "published" && new Date(trip.startsAt).getTime() > Date.now();
	const timing = assignmentTripTimingMeta[getAssignmentTripTiming(trip)];

	return (
		<section className="space-y-4">
			<div className="grid gap-3 rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
				<div>
					<h2 className="text-lg font-extrabold text-[#10221b]">{trip.title}</h2>
					<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#55685a]">
						<span className="inline-flex items-center gap-1.5">
							<CalendarDays className="size-4" />
							{formatAssignmentTripTimeRange(trip.startsAt, trip.endsAt)}
						</span>
					</div>
				</div>
				<span
					className={`inline-flex justify-self-start rounded-lg px-3 py-2 text-xs font-extrabold sm:justify-self-end ${timing.className}`}
				>
					{timing.label}
				</span>
			</div>

			<div className="min-h-56 rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="flex items-center gap-2 text-base font-extrabold text-[#10221b]">
						<UserRound className="size-5 text-[#164027]" />
						Porter đã phân công ({trip.assignments.length})
					</h2>
					{getAssignmentTripTiming(trip) === "upcoming" && (
						<Button
							size="sm"
							className="gap-2"
							onClick={() => {
								window.history.pushState({}, "", "/host/porter?view=find");
								window.dispatchEvent(new PopStateEvent("popstate"));
							}}
						>
							<UserRound className="size-4" />
							Tìm thêm người hỗ trợ
						</Button>
					)}
				</div>

				{trip.assignments.length === 0 ? (
					<div className="mt-5 rounded-xl border border-dashed border-[#cbd9cd] p-8 text-center text-sm font-bold text-[#667a6d]">
						Chuyến đi này chưa có Porter được phân công.
					</div>
				) : (
					<ul className="mt-5 space-y-3">
						{trip.assignments.map((assignment) => (
							<li
								key={assignment.porterId}
								className="grid min-h-28 gap-4 rounded-xl border border-[#dfe8df] bg-[#fbfcfb] p-5 md:grid-cols-[56px_minmax(0,1fr)_190px_auto] md:items-center"
							>
								<div className="flex size-14 items-center justify-center rounded-full bg-[#edf1ef] text-[#405148]">
									<UserRound className="size-7" />
								</div>
								<div className="min-w-0">
									<h3 className="truncate text-sm font-extrabold text-[#10221b]">
										{assignment.displayName?.trim() || `Porter ${assignment.porterId.slice(0, 8)}`}
									</h3>
									{assignment.email && (
										<span className="mt-1 block truncate text-xs font-semibold text-[#667a6d]">
											{assignment.email}
										</span>
									)}
								</div>
								<div className="border-[#e2e9e3] text-xs text-[#55685a] md:border-l md:pl-5">
									<span className="block font-bold text-[#10221b]">Thời điểm phân công</span>
									<span className="mt-1 block">{formatAssignmentTime(assignment.assignedAt)}</span>
								</div>
								<div className="flex flex-wrap items-center gap-2 md:justify-end">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5ee] px-3 py-2 text-xs font-bold text-[#164027]">
										<CheckCircle2 className="size-3.5" />
										{assignmentStatusLabels[assignment.status]}
									</span>
									{assignment.status === "unassigned" && canFindReplacement && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												window.history.pushState(
													{},
													"",
													`/host/porter?view=find&tripId=${trip.id}`
												);
												window.dispatchEvent(new PopStateEvent("popstate"));
											}}
										>
											Tìm Porter thay thế
										</Button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

export function HostPorterRequestsPage({
	initialTripId,
	initialView,
}: HostPorterRequestsPageProps) {
	const candidateTripsQuery = usePorterCandidateTrips();
	const assignmentTripsQuery = useHostPorterAssignments();
	const [activeTab, setActiveTab] = useState<PorterTab>(() => normalizeView(initialView));
	const [selectedTripId, setSelectedTripId] = useState(initialTripId ?? "");
	const [tripSearch, setTripSearch] = useState("");
	const [assignmentTripFilter, setAssignmentTripFilter] = useState<AssignmentTripFilter>("all");
	const trips =
		activeTab === "assigned" ? (assignmentTripsQuery.data ?? []) : candidateTripsQuery.trips;
	const isLoading =
		activeTab === "assigned" ? assignmentTripsQuery.isLoading : candidateTripsQuery.isLoading;
	const error =
		activeTab === "assigned"
			? assignmentTripsQuery.error
				? "Không thể tải lịch sử phân công Porter. Vui lòng thử lại."
				: ""
			: candidateTripsQuery.error;

	const refetchTrips = () => {
		if (activeTab === "assigned") {
			void assignmentTripsQuery.refetch();
		} else {
			void candidateTripsQuery.refetch();
		}
	};

	useEffect(() => {
		setActiveTab(normalizeView(initialView));
		setTripSearch("");
	}, [initialView]);

	useEffect(() => {
		if (initialTripId) {
			setSelectedTripId(initialTripId);
		}
	}, [initialTripId]);

	useEffect(() => {
		if (activeTab === "requests") return;
		if (isLoading || trips.some((trip) => trip.id === selectedTripId)) return;
		const nextTripId = trips[0]?.id ?? "";
		setSelectedTripId(nextTripId);
		syncSelectedTripToUrl(nextTripId, activeTab);
	}, [activeTab, isLoading, selectedTripId, trips]);

	const selectedTrip = useMemo(
		() => trips.find((trip) => trip.id === selectedTripId) ?? null,
		[trips, selectedTripId]
	);
	const selectedRegularTrip = useMemo(
		() => candidateTripsQuery.trips.find((trip) => trip.id === selectedTripId) ?? null,
		[candidateTripsQuery.trips, selectedTripId]
	);
	const filteredAssignmentTrips = useMemo(() => {
		const keyword = tripSearch.trim().toLocaleLowerCase("vi-VN");
		const assignmentTrips = assignmentTripsQuery.data ?? [];
		return assignmentTrips.filter((trip) => {
			const matchesSearch = !keyword || trip.title.toLocaleLowerCase("vi-VN").includes(keyword);
			const matchesTiming =
				assignmentTripFilter === "all" || getAssignmentTripTiming(trip) === assignmentTripFilter;
			return matchesSearch && matchesTiming;
		});
	}, [assignmentTripFilter, assignmentTripsQuery.data, tripSearch]);
	const displayedAssignmentTrip = useMemo(
		() => filteredAssignmentTrips.find((trip) => trip.id === selectedTripId) ?? null,
		[filteredAssignmentTrips, selectedTripId]
	);
	const selectedTripMissing = Boolean(selectedTripId && trips.length > 0 && !selectedTrip);

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-4 py-8 sm:px-6">
			<div className="mx-auto max-w-[1440px] space-y-6">
				<header className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
					<h1 className="text-2xl font-extrabold text-[#10221b]">
						{activeTab === "find"
							? "Tìm người hỗ trợ chuyến đi"
							: activeTab === "requests"
								? "Yêu cầu Porter đã gửi"
								: "Porter đã phân công"}
					</h1>
				</header>

				{activeTab === "find" && (
					<div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm">
							<div className="flex items-start gap-3">
								<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
									<BriefcaseBusiness className="size-5" />
								</div>
								<div>
									<h2 className="text-base font-extrabold text-[#10221b]">Chọn chuyến đi</h2>
								</div>
							</div>

							{isLoading && (
								<output className="mt-5 flex items-center gap-2 rounded-2xl bg-[#f8faf8] p-4 text-xs font-bold text-[#164027]">
									<Loader2 className="size-4 animate-spin" />
									Đang tải chuyến đi...
								</output>
							)}

							{!isLoading && error && (
								<div
									role="alert"
									className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
								>
									<div className="flex items-start gap-2">
										<AlertTriangle className="size-4 shrink-0" />
										<p className="font-bold">{error}</p>
									</div>
									<Button size="sm" variant="outline" className="mt-3 gap-2" onClick={refetchTrips}>
										<RefreshCw className="size-3.5" />
										Tải lại
									</Button>
								</div>
							)}

							{!isLoading && !error && trips.length === 0 && (
								<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9cd] bg-[#f8faf8] p-5 text-center text-xs text-[#667a6d]">
									Không có chuyến đi nào sắp diễn ra.
								</div>
							)}

							{!isLoading && !error && trips.length > 0 && (
								<>
									<label
										htmlFor="host-porter-trip"
										className="mt-5 block text-xs font-extrabold text-[#10221b]"
									>
										Chuyến đi
									</label>
									<select
										id="host-porter-trip"
										value={selectedTripId}
										onChange={(event) => {
											setSelectedTripId(event.target.value);
											syncSelectedTripToUrl(event.target.value, activeTab);
										}}
										className="mt-2 w-full rounded-2xl border border-[#cbd9cd] bg-white px-3 py-3 text-sm font-semibold text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/15"
									>
										{trips.map((trip) => (
											<option key={trip.id} value={trip.id}>
												{getTripOptionLabel(trip)}
											</option>
										))}
									</select>

									{selectedRegularTrip && (
										<div className="mt-4 rounded-2xl bg-[#f8faf8] p-4 text-xs text-[#55685a]">
											<span className="block font-extrabold text-[#10221b]">
												{selectedRegularTrip.title}
											</span>
											<span className="mt-1 block">
												{formatDateRange(selectedRegularTrip.startsAt, selectedRegularTrip.endsAt)}
											</span>
											<span className="mt-1 block">
												Trạng thái: {formatTripStatus(selectedRegularTrip.status)}
											</span>
										</div>
									)}

									{selectedTripMissing && (
										<div
											role="alert"
											className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900"
										>
											Không tìm thấy chuyến đi đã chọn trong danh sách quản lý.
										</div>
									)}
								</>
							)}
						</section>

						{selectedRegularTrip ? (
							<AvailablePortersPanel tripId={selectedRegularTrip.id} />
						) : (
							<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-8 text-center shadow-sm">
								<BriefcaseBusiness className="mx-auto size-8 text-[#164027]" />
								<span className="mt-3 block text-sm font-extrabold text-[#10221b]">
									Chọn chuyến đi để tìm Porter phù hợp.
								</span>
							</section>
						)}
					</div>
				)}

				{activeTab === "requests" && <HostRequestList />}

				{activeTab === "assigned" && (
					<div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
						<section className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
							<h2 className="text-lg font-extrabold text-[#10221b]">Danh sách chuyến đi</h2>
							{isLoading ? (
								<div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#667a6d]">
									<Loader2 className="size-4 animate-spin" />
									Đang tải chuyến đi...
								</div>
							) : error ? (
								<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
									<p>{error}</p>
									<Button size="sm" variant="outline" className="mt-3" onClick={refetchTrips}>
										Tải lại
									</Button>
								</div>
							) : trips.length === 0 ? (
								<p className="mt-4 text-xs font-semibold text-[#667a6d]">
									Chưa có lịch sử phân công Porter.
								</p>
							) : (
								<div className="mt-4 space-y-3">
									<div className="relative">
										<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#667a6d]" />
										<input
											type="search"
											value={tripSearch}
											onChange={(event) => setTripSearch(event.target.value)}
											placeholder="Tìm theo tên chuyến đi"
											className="w-full rounded-xl border border-[#cbd9cd] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/15"
										/>
									</div>
									<div
										className="grid grid-cols-2 gap-2 xl:grid-cols-4"
										aria-label="Lọc chuyến đi theo thời gian"
									>
										{assignmentTripFilters.map((filter) => (
											<button
												key={filter.value}
												type="button"
												onClick={() => setAssignmentTripFilter(filter.value)}
												className={`rounded-lg px-2 py-2 text-xs font-bold transition ${
													assignmentTripFilter === filter.value
														? "bg-[#164027] text-white"
														: "bg-[#f1f5f0] text-[#55685a] hover:bg-[#e6eee7]"
												}`}
											>
												{filter.label}
											</button>
										))}
									</div>
									{filteredAssignmentTrips.length === 0 ? (
										<p className="rounded-xl border border-dashed border-[#cbd9cd] p-4 text-center text-xs font-semibold text-[#667a6d]">
											Không tìm thấy chuyến đi.
										</p>
									) : (
										<ul className="space-y-2">
											{filteredAssignmentTrips.map((trip) => {
												const isSelected = trip.id === selectedTripId;
												const timing = assignmentTripTimingMeta[getAssignmentTripTiming(trip)];
												return (
													<li key={trip.id}>
														<button
															type="button"
															onClick={() => {
																setSelectedTripId(trip.id);
																syncSelectedTripToUrl(trip.id, activeTab);
															}}
															className={`w-full rounded-xl border p-3 text-left transition ${
																isSelected
																	? "border-[#164027] bg-[#edf5ee]"
																	: "border-[#dfe8df] hover:border-[#9fb4a3] hover:bg-[#f8faf8]"
															}`}
														>
															<div className="flex items-start justify-between gap-3">
																<span className="min-w-0 truncate text-sm font-extrabold text-[#10221b]">
																	{trip.title}
																</span>
																<span
																	className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-extrabold ${timing.className}`}
																>
																	{timing.label}
																</span>
															</div>
															<div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-[#667a6d]">
																<span className="inline-flex items-center gap-1.5">
																	<CalendarDays className="size-3.5" />
																	{formatAssignmentTripDateRange(trip.startsAt, trip.endsAt)}
																</span>
																<ChevronRight className="size-4 shrink-0" />
															</div>
															<span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#55685a]">
																<UserRound className="size-3.5" />
																{trip.assignedPorterCount} Porter
															</span>
														</button>
													</li>
												);
											})}
										</ul>
									)}
								</div>
							)}
						</section>

						{displayedAssignmentTrip ? (
							<HostAssignedPortersList trip={displayedAssignmentTrip} />
						) : (
							!isLoading && !error && <EmptyFutureTab title="Chọn chuyến đi để xem Porter" />
						)}
					</div>
				)}
			</div>
		</div>
	);
}
