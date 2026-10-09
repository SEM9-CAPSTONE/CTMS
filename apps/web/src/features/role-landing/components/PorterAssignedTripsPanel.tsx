import { AlertCircle, CalendarDays, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { useAssignedTrips } from "../../trips/hooks/useAssignedTrips";
import type { PorterAssignedTrip, TripStatus } from "../../trips/types";

const statusLabels: Record<TripStatus, string> = {
	draft: "Bản nháp",
	pending_approval: "Chờ duyệt",
	published: "Đã xuất bản",
	ongoing: "Đang diễn ra",
	completed: "Đã hoàn thành",
	cancelled: "Đã hủy",
	rejected: "Bị từ chối",
};

function formatRange(startsAt: string, endsAt: string) {
	const options: Intl.DateTimeFormatOptions = {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	};
	return `${new Date(startsAt).toLocaleString("vi-VN", options)} – ${new Date(endsAt).toLocaleString("vi-VN", options)}`;
}

export interface PorterAssignedTripsPanelProps {
	onNavigateToTripRoster?: (tripId: string) => void;
}

export interface PorterAssignedTripsPanelViewProps extends PorterAssignedTripsPanelProps {
	trips: PorterAssignedTrip[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<unknown>;
}

export function PorterAssignedTripsPanelView({
	onNavigateToTripRoster,
	trips,
	isLoading,
	error,
	refetch,
}: PorterAssignedTripsPanelViewProps) {
	return (
		<section
			id="porter-assigned-trips"
			aria-label="Chuyến đi được phân công"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-extrabold text-[#10221b]">Chuyến đi được phân công</h2>
					<p className="mt-1 text-xs text-[#667a6d]">
						Mở chuyến đi để xem danh sách và cập nhật điểm danh.
					</p>
				</div>
				{!isLoading && (
					<Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-2">
						<RefreshCw className="size-4" /> Tải lại
					</Button>
				)}
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

			{!isLoading && !error && trips.length === 0 && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#d2ded3] bg-[#fbfdfb] p-10 text-center">
					<CalendarDays className="mx-auto size-7 text-[#7b8c82]" />
					<p className="mt-3 text-sm font-bold text-[#55685a]">
						Chưa có chuyến đi nào được phân công.
					</p>
				</div>
			)}

			{!isLoading && !error && trips.length > 0 && (
				<ul className="mt-5 grid gap-3 md:grid-cols-2">
					{trips.map((trip) => (
						<li key={trip.tripId} className="rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<h3 className="truncate font-extrabold text-[#10221b]">{trip.title}</h3>
									<p className="mt-1 text-xs text-[#667a6d]">
										{formatRange(trip.startsAt, trip.endsAt)}
									</p>
									<span className="mt-2 inline-flex rounded-full bg-[#164027]/10 px-2.5 py-1 text-[11px] font-bold text-[#164027]">
										{statusLabels[trip.status]}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => onNavigateToTripRoster?.(trip.tripId)}
									className="shrink-0 gap-1"
								>
									Mở danh sách <ChevronRight className="size-4" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export function PorterAssignedTripsPanel(props: PorterAssignedTripsPanelProps) {
	const state = useAssignedTrips();
	return <PorterAssignedTripsPanelView {...state} {...props} />;
}
