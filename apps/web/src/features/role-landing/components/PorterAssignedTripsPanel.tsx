import {
	AlertCircle,
	ArrowUpRight,
	CalendarDays,
	Loader2,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { useAssignedTrips } from "../../trips/hooks/useAssignedTrips";
import type { PorterAssignedTrip } from "../../trips/types";
import {
	PORTER_TRIP_PHASES,
	type PorterTripPhase,
	formatTripSchedule,
	normalizeSearchText,
	porterTripPhaseLabels,
	toPorterTripPhase,
} from "../utils/porter-assignment";
import { PorterTripPhaseBadge } from "./PorterTripPhaseBadge";

type PhaseFilter = "all" | PorterTripPhase;
export type PorterAssignedTripsPanelMode = "assignments" | "checkins";

const filterTabs: { key: PhaseFilter; label: string }[] = [
	{ key: "all", label: "Tất cả" },
	...PORTER_TRIP_PHASES.map((phase) => ({ key: phase, label: porterTripPhaseLabels[phase] })),
];

export interface PorterAssignedTripsPanelProps {
	onViewTripDetail?: (tripId: string) => void;
	onOpenRoster?: (tripId: string) => void;
	mode?: PorterAssignedTripsPanelMode;
}

export interface PorterAssignedTripsPanelViewProps extends PorterAssignedTripsPanelProps {
	trips: PorterAssignedTrip[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<unknown>;
	isStale?: boolean;
	updatedAt?: number | null;
}

export function PorterAssignedTripsPanelView({
	onViewTripDetail,
	onOpenRoster,
	mode = "assignments",
	trips,
	isLoading,
	error,
	refetch,
	isStale,
	updatedAt,
}: PorterAssignedTripsPanelViewProps) {
	const [filter, setFilter] = useState<PhaseFilter>("all");
	const [search, setSearch] = useState("");

	const displayableTrips = useMemo(
		() =>
			trips.flatMap((trip) => {
				const phase = toPorterTripPhase(trip.status);
				return phase ? [{ trip, phase }] : [];
			}),
		[trips]
	);
	const visibleTrips = useMemo(() => {
		const keyword = normalizeSearchText(search);
		return displayableTrips.filter(
			({ trip, phase }) =>
				(filter === "all" || phase === filter) &&
				(!keyword || normalizeSearchText(`${trip.title} ${trip.routeName ?? ""}`).includes(keyword))
		);
	}, [displayableTrips, filter, search]);
	const hasCriteria = filter !== "all" || search.trim() !== "";
	const isCheckInMode = mode === "checkins";
	const title = isCheckInMode ? "Chọn chuyến đi để điểm danh" : "Chuyến đi được phân công";
	const description = isCheckInMode
		? "Chọn một chuyến đi được phân công để mở danh sách điểm danh thành viên."
		: "Xem lịch trình và thông tin các chuyến đi bạn tham gia.";

	return (
		<section
			id="porter-assigned-trips"
			aria-label={title}
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex items-start justify-between gap-4 border-b border-[#e5eee7] pb-5">
				<div>
					<h1 className="text-xl font-extrabold text-[#10221b]">{title}</h1>
					<p className="mt-1 text-sm text-[#667a6d]">{description}</p>
					{updatedAt && isStale ? (
						<p className="mt-1 text-xs text-[#667a6d]">
							Dữ liệu tải lúc {new Date(updatedAt).toLocaleString("vi-VN")} · Cần tải lại để xác
							nhận trạng thái mới nhất.
						</p>
					) : null}
				</div>
				<button
					type="button"
					aria-label="Tải lại danh sách"
					onClick={() => void refetch()}
					disabled={isLoading}
					className="rounded-full p-2 text-[#55685a] transition hover:bg-[#eef4ef] disabled:opacity-50"
				>
					<RefreshCw className="size-5" />
				</button>
			</div>

			<div
				role="tablist"
				aria-label="Lọc theo trạng thái"
				className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#f3f7f3] p-1 sm:grid-cols-4"
			>
				{filterTabs.map((tab) => (
					<button
						key={tab.key}
						type="button"
						role="tab"
						aria-selected={filter === tab.key}
						onClick={() => setFilter(tab.key)}
						className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
							filter === tab.key
								? "bg-white text-[#10221b] shadow-sm"
								: "text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className="mt-4 flex gap-3">
				<input
					type="search"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Tìm kiếm chuyến đi..."
					aria-label="Tìm kiếm chuyến đi"
					className="min-w-0 flex-1 rounded-2xl border border-[#dfe8df] px-4 py-2.5 text-sm outline-none focus:border-[#2d5a27] focus:ring-2 focus:ring-[#2d5a27]/20"
				/>
				<Button
					variant="outline"
					onClick={() => {
						setFilter("all");
						setSearch("");
					}}
					disabled={!hasCriteria}
					className="shrink-0 gap-2 rounded-2xl"
				>
					<RotateCcw className="size-4" /> Đặt lại
				</Button>
			</div>

			{isLoading && (
				<div className="flex items-center justify-center gap-3 py-10 text-sm font-semibold text-[#667a6d]">
					<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải chuyến đi được phân
					công...
				</div>
			)}

			{!isLoading && error && (
				<div
					role="alert"
					className="mt-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 sm:flex-row sm:items-center"
				>
					<AlertCircle className="size-5 shrink-0" />
					<span className="flex-1">{error}</span>
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						Thử lại
					</Button>
				</div>
			)}

			{!isLoading && !error && visibleTrips.length === 0 && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#d2ded3] bg-[#fbfdfb] p-10 text-center">
					<CalendarDays className="mx-auto size-7 text-[#7b8c82]" />
					<p className="mt-3 text-sm font-bold text-[#55685a]">
						{displayableTrips.length === 0
							? "Chưa có chuyến đi nào được phân công."
							: "Không tìm thấy chuyến đi phù hợp."}
					</p>
				</div>
			)}

			{!isLoading && !error && visibleTrips.length > 0 && (
				<div className="mt-5">
					<div className="hidden grid-cols-[1.4fr_1fr_0.8fr_auto] gap-4 border-b border-[#e5eee7] pb-2 text-xs font-bold text-[#667a6d] md:grid">
						<span>Chuyến đi</span>
						<span>Thời gian</span>
						<span>Trạng thái</span>
						<span className="text-right">Thao tác</span>
					</div>
					<ul className="divide-y divide-[#eef3ef]">
						{visibleTrips.map(({ trip, phase }) => {
							const schedule = formatTripSchedule(trip.startsAt, trip.endsAt);
							return (
								<li
									key={trip.tripId}
									className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[1.4fr_1fr_0.8fr_auto]"
								>
									<div className="min-w-0">
										<h2 className="truncate font-extrabold text-[#10221b]">{trip.title}</h2>
										{trip.routeName && (
											<p className="truncate text-xs text-[#667a6d]">{trip.routeName}</p>
										)}
									</div>
									<div className="col-start-1 md:col-start-auto">
										<p className="text-sm font-bold text-[#10221b]">{schedule.date}</p>
										<p className="text-xs text-[#667a6d]">{schedule.hours}</p>
									</div>
									<div className="col-start-1 md:col-start-auto">
										<PorterTripPhaseBadge phase={phase} />
									</div>
									<div className="col-start-2 row-span-3 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto md:text-right">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												isCheckInMode
													? onOpenRoster?.(trip.tripId)
													: onViewTripDetail?.(trip.tripId)
											}
											aria-label={`${isCheckInMode ? "Mở điểm danh" : "Chi tiết"} ${trip.title}`}
											className="gap-1 rounded-full"
										>
											{isCheckInMode ? "Mở điểm danh" : "Chi tiết"}{" "}
											<ArrowUpRight className="size-4" />
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</section>
	);
}

export function PorterAssignedTripsPanel(props: PorterAssignedTripsPanelProps) {
	const state = useAssignedTrips();
	return <PorterAssignedTripsPanelView {...state} {...props} />;
}
