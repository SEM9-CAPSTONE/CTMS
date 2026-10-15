import { AlertTriangle, BriefcaseBusiness, CalendarDays, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { useHostOperationalOverview } from "../hooks/useHostOperationalOverview";
import type { Metric } from "../types";
import { getOperationalTripHeading } from "../utils/host-operational-overview";
import { HostOperationalTripSelector } from "./HostOperationalTripSelector";
import { HostTripMap } from "./HostTripMap";
import { MetricCard } from "./MetricCard";

const statusLabels = { published: "Đang mở bán", ongoing: "Đang diễn ra" };
const riskLabels = { green: "Thấp", yellow: "Trung bình", red: "Cao" };
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
}: {
	hostId: string;
	onNavigateToTripDetail?: (tripId: string) => void;
}) {
	const data = useHostOperationalOverview(hostId);
	const [selectedTripId, setSelectedTripId] = useState<string>();
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
	const trip = data.operationalTrips.find((item) => item.id === selectedTripId) ?? data.focusTrip;
	return (
		<>
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
			<section aria-label="Chỉ số vận hành" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric) => (
					<MetricCard key={metric.label} metric={metric} />
				))}
			</section>
			<section>
				<Card className="grid items-start gap-6 rounded-[28px] border-[#dfe8df] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<div className="min-w-0">
						<h2 className="text-xl font-extrabold">{getOperationalTripHeading(trip)}</h2>
						<HostOperationalTripSelector
							trips={data.operationalTrips}
							selectedTripId={trip?.id}
							onSelect={setSelectedTripId}
						/>
						{trip ? (
							<div className="mt-5">
								<div className="min-w-0 space-y-4">
									<h3 className="text-2xl font-extrabold text-[#164027]">{trip.title}</h3>
									<p>
										{trip.displayStatus === "ongoing"
											? statusLabels.ongoing
											: statusLabels.published}
									</p>
									<dl className="grid gap-4 rounded-2xl bg-[#f2f7ef] p-4 sm:grid-cols-2">
										<div>
											<dt>Khởi hành</dt>
											<dd className="font-bold">{formatDateTime(trip.startsAt)}</dd>
										</div>
										<div>
											<dt>Kết thúc</dt>
											<dd className="font-bold">{formatDateTime(trip.endsAt)}</dd>
										</div>
										<div>
											<dt>Chỗ giữ / đặt</dt>
											<dd className="font-bold">
												{trip.seatsTaken} / {trip.capacityMax ?? "Không giới hạn"}
											</dd>
										</div>
										<div>
											<dt>Rủi ro thời tiết</dt>
											<dd className="font-bold">
												{trip.weatherRiskLevel
													? riskLabels[trip.weatherRiskLevel]
													: "Chưa có dữ liệu"}
											</dd>
										</div>
									</dl>
									{onNavigateToTripDetail && (
										<Button
											onClick={() => onNavigateToTripDetail(trip.id)}
											className="rounded-xl bg-[#164027] px-4 py-2 font-bold text-white"
										>
											Xem chi tiết chuyến đi
										</Button>
									)}
								</div>
							</div>
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
