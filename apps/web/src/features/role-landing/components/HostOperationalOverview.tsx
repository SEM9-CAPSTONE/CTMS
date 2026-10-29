import { AlertTriangle, BriefcaseBusiness, CalendarDays, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { useHostOperationalOverview } from "../hooks/useHostOperationalOverview";
import type { Metric } from "../types";
import { getOperationalTripHeading } from "../utils/host-operational-overview";
import { HostOperationalTripSelector, type OperationalStatus } from "./HostOperationalTripSelector";
import { HostTripMap } from "./HostTripMap";
import { MetricCard } from "./MetricCard";

const formatDateTime = (value: string | number) =>
	new Date(value).toLocaleString("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

export function HostOperationalOverview({
	hostId,
	onNavigateToTripDetail,
	showMetrics = true,
	showToolbar = true,
}: {
	hostId: string;
	onNavigateToTripDetail?: (tripId: string) => void;
	showMetrics?: boolean;
	showToolbar?: boolean;
}) {
	const data = useHostOperationalOverview(hostId);
	const [selectedTripId, setSelectedTripId] = useState<string>();
	const [statusFilter, setStatusFilter] = useState<OperationalStatus>();
	if (data.isLoading) return <output>Đang tải tổng quan vận hành...</output>;
	if (data.isError)
		return (
			<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
				<p>Không thể tải dữ liệu vận hành. Vui lòng thử lại.</p>
				<Button variant="ghost" onClick={data.refresh} className="mt-3 font-bold">
					Thử lại
				</Button>
			</div>
		);
	const metrics: Metric[] = [
		{
			label: "Chuyến đi hôm nay",
			value: String(data.todayTrips),
			helper: `${data.ongoingTrips} chuyến đang diễn ra`,
			tone: "green",
			icon: CalendarDays,
		},
		{
			label: "Chỗ giữ / đặt hôm nay",
			value: String(data.seatsToday),
			helper: "Tổng số chỗ trên các chuyến hôm nay",
			tone: "blue",
			icon: Users,
		},
		{
			label: "Cảnh báo thời tiết",
			value: String(data.weatherWarnings),
			helper: data.unknownWeather
				? `${data.unknownWeather} chuyến chưa có dữ liệu thời tiết`
				: "Các chuyến sắp khởi hành và đang diễn ra",
			tone: "amber",
			icon: AlertTriangle,
		},
		{
			label: "Porter được phân công hôm nay",
			value: data.portersUnavailable ? "—" : String(data.assignedPortersToday),
			helper: data.portersUnavailable
				? "Chưa tải được dữ liệu phân công"
				: "Số porter riêng biệt có phân công hiệu lực",
			tone: "blue",
			icon: BriefcaseBusiness,
		},
	];
	// Default to the status of the selected/focus trip until the host picks a filter.
	const defaultTrip =
		data.operationalTrips.find((item) => item.id === selectedTripId) ?? data.focusTrip;
	const activeStatus: OperationalStatus =
		statusFilter ?? (defaultTrip?.displayStatus === "published" ? "published" : "ongoing");
	const filteredTrips = data.operationalTrips.filter((item) => item.displayStatus === activeStatus);
	const trip = filteredTrips.find((item) => item.id === selectedTripId) ?? filteredTrips[0];
	const handleStatusChange = (status: OperationalStatus) => {
		setStatusFilter(status);
		setSelectedTripId(data.operationalTrips.find((item) => item.displayStatus === status)?.id);
	};
	return (
		<>
			{showToolbar && (
				<div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#667a6d]">
					<p>Dữ liệu cập nhật lúc {formatDateTime(data.updatedAt)} · Tự làm mới mỗi 30 giây</p>
					<Button
						variant="ghost"
						size="sm"
						onClick={data.refresh}
						disabled={data.isRefreshing}
						className="inline-flex items-center gap-2 font-bold disabled:opacity-50"
					>
						<RefreshCw className="size-4" />
						Làm mới dữ liệu
					</Button>
				</div>
			)}
			{showMetrics && (
				<section aria-label="Chỉ số vận hành" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{metrics.map((metric) => (
						<MetricCard key={metric.label} metric={metric} />
					))}
				</section>
			)}
			<section>
				<Card className="grid items-start gap-6 rounded-[28px] border-[#dfe8df] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<div className="min-w-0">
						<div className="flex items-center justify-between gap-2">
							<h2 className="text-xl font-extrabold">{getOperationalTripHeading(trip)}</h2>
							{!showToolbar && (
								<Button
									size="sm"
									variant="ghost"
									aria-label="Làm mới bản đồ"
									onClick={data.refresh}
									disabled={data.isRefreshing}
								>
									<RefreshCw aria-hidden="true" className="size-3.5" />
								</Button>
							)}
						</div>
						{!showToolbar && (
							<p className="mt-1 text-[11px] text-[#829087]">
								Cập nhật bản đồ: {formatDateTime(data.updatedAt)}
							</p>
						)}
						{data.operationalTrips.length ? (
							<>
								<HostOperationalTripSelector
									trips={data.operationalTrips}
									status={activeStatus}
									onStatusChange={handleStatusChange}
									selectedTripId={trip?.id}
									onSelect={setSelectedTripId}
								/>
								{trip && onNavigateToTripDetail && (
									<Button
										onClick={() => onNavigateToTripDetail(trip.id)}
										className="mt-5 rounded-xl bg-[#164027] px-4 py-2 font-bold text-white"
									>
										Xem chi tiết chuyến đi
									</Button>
								)}
							</>
						) : (
							<p className="mt-5 text-[#667a6d]">Chưa có chuyến sắp khởi hành hoặc đang diễn ra.</p>
						)}
					</div>
					{trip && (
						<div className="min-w-0">
							<HostTripMap key={trip.id} hostId={hostId} trip={trip} />
						</div>
					)}
				</Card>
			</section>
		</>
	);
}
