import { useState } from "react";
import { Card, DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import { EXCLUDED_TRIP_REASON_LABELS, formatShortDateVi } from "../constants";
import type {
	HostOperationsMetrics,
	HostUpcomingBlock,
	OperationsAreaBreakdown,
	OperationsRouteBreakdown,
	OperationsTripBreakdown,
	UpcomingTripSummary,
} from "../types";

type BreakdownTab = "route" | "area" | "trip";

export interface HostOperationsBreakdownProps {
	operations: HostOperationsMetrics;
	upcoming: HostUpcomingBlock;
}

const routeColumns: DataTableColumn<OperationsRouteBreakdown>[] = [
	{ key: "routeName", header: "Tuyến trekking", render: (r) => r.routeName || "Chưa có tên tuyến" },
	{ key: "tripCount", header: "Số chuyến", align: "right", render: (r) => r.tripCount },
	{
		key: "totalGuests",
		header: "Lượt khách",
		align: "right",
		render: (r) => (r.totalGuests === null ? "Chưa có dữ liệu" : r.totalGuests),
	},
	{
		key: "fillRate",
		header: "Tỷ lệ lấp đầy",
		align: "right",
		render: (r) => (r.fillRate === null ? "Chưa có dữ liệu" : `${r.fillRate}%`),
	},
	{
		key: "cancellationRate",
		header: "Tỷ lệ hủy đơn",
		align: "right",
		render: (r) => (r.cancellationRate === null ? "Chưa có dữ liệu" : `${r.cancellationRate}%`),
	},
];

const areaColumns: DataTableColumn<OperationsAreaBreakdown>[] = [
	{ key: "areaName", header: "Khu vực", render: (a) => a.areaName || "Chưa gắn khu vực" },
	{ key: "tripCount", header: "Số chuyến", align: "right", render: (a) => a.tripCount },
	{
		key: "totalGuests",
		header: "Lượt khách",
		align: "right",
		render: (a) => (a.totalGuests === null ? "Chưa có dữ liệu" : a.totalGuests),
	},
	{
		key: "fillRate",
		header: "Tỷ lệ lấp đầy",
		align: "right",
		render: (a) => (a.fillRate === null ? "Chưa có dữ liệu" : `${a.fillRate}%`),
	},
	{
		key: "cancellationRate",
		header: "Tỷ lệ hủy đơn",
		align: "right",
		render: (a) => (a.cancellationRate === null ? "Chưa có dữ liệu" : `${a.cancellationRate}%`),
	},
];

const tripColumns: DataTableColumn<OperationsTripBreakdown>[] = [
	{ key: "title", header: "Chuyến đi", render: (t) => t.title },
	{ key: "startsAt", header: "Khởi hành", render: (t) => formatShortDateVi(t.startsAt) },
	{
		key: "seats",
		header: "Chỗ / Sức chứa",
		align: "right",
		render: (t) =>
			t.capacityMax === null ? `${t.seatsTaken} / Chưa đặt` : `${t.seatsTaken} / ${t.capacityMax}`,
	},
	{
		key: "fillRate",
		header: "Lấp đầy",
		align: "right",
		render: (t) => (t.fillRate === null ? "Chưa có dữ liệu" : `${t.fillRate}%`),
	},
	{
		key: "cancellationRate",
		header: "Hủy đơn",
		align: "right",
		render: (t) => (t.cancellationRate === null ? "Chưa có dữ liệu" : `${t.cancellationRate}%`),
	},
];

const upcomingColumns: DataTableColumn<UpcomingTripSummary>[] = [
	{ key: "title", header: "Chuyến đi", render: (t) => t.title },
	{ key: "areaName", header: "Khu vực", render: (t) => t.areaName || "Chưa gắn khu vực" },
	{ key: "startsAt", header: "Khởi hành", render: (t) => formatShortDateVi(t.startsAt) },
	{
		key: "status",
		header: "Trạng thái",
		render: (t) => (
			<StatusBadge tone={t.status === "ongoing" ? "info" : "success"}>
				{t.status === "ongoing" ? "Đang diễn ra" : "Đang mở bán"}
			</StatusBadge>
		),
	},
	{
		key: "seatsTaken",
		header: "Chỗ đã giữ / Tối đa",
		align: "right",
		render: (t) =>
			t.capacityMax === null
				? `${t.seatsTaken} / Không giới hạn`
				: `${t.seatsTaken} / ${t.capacityMax}`,
	},
];

export function HostOperationsBreakdown({ operations, upcoming }: HostOperationsBreakdownProps) {
	const [tab, setTab] = useState<BreakdownTab>("route");

	return (
		<div className="space-y-4">
			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-[#10221b]">
						Chi tiết vận hành (chuyến đã hoàn thành)
					</h2>
					<div className="flex items-center gap-1.5" role="tablist" aria-label="Phân nhóm vận hành">
						{(
							[
								{ key: "route", label: "Theo tuyến" },
								{ key: "area", label: "Theo khu vực" },
								{ key: "trip", label: "Theo chuyến" },
							] as const
						).map((item) => (
							<button
								key={item.key}
								type="button"
								role="tab"
								aria-selected={tab === item.key}
								onClick={() => setTab(item.key)}
								className={
									tab === item.key
										? "rounded-full bg-[#164027] px-3 py-1 text-xs font-semibold text-white"
										: "rounded-full border border-[#d6e2d6] bg-white px-3 py-1 text-xs font-medium text-[#2c4234] hover:bg-[#f2f7f2]"
								}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>

				{tab === "route" && (
					<DataTable
						columns={routeColumns}
						rows={operations.byRoute}
						getRowKey={(r) => r.routeId}
						ariaLabel="Chi tiết vận hành theo tuyến"
						emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
					/>
				)}
				{tab === "area" && (
					<DataTable
						columns={areaColumns}
						rows={operations.byArea}
						getRowKey={(a) => a.areaCode ?? "unknown"}
						ariaLabel="Chi tiết vận hành theo khu vực"
						emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
					/>
				)}
				{tab === "trip" && (
					<DataTable
						columns={tripColumns}
						rows={operations.byTrip}
						getRowKey={(t) => t.tripId}
						ariaLabel="Chi tiết vận hành theo chuyến"
						emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
					/>
				)}

				<div className="grid grid-cols-1 gap-3 border-t border-[#e8efe8] pt-3 text-xs text-[#435649] sm:grid-cols-2">
					<div>
						<span className="font-semibold text-[#10221b]">Chuyến đã hủy trong kỳ: </span>
						{operations.cancelledTrips.count} chuyến
						{operations.cancelledTrips.tripCancellationRate !== null
							? ` (tỷ lệ hủy chuyến: ${operations.cancelledTrips.tripCancellationRate}%)`
							: ""}
						{" · "}
						{operations.cancelledTrips.bookingsOnCancelledTrips} đơn bị hủy thuộc các chuyến này.
					</div>
					{operations.excludedTrips.length > 0 && (
						<div>
							<span className="font-semibold text-[#10221b]">
								Chuyến không đưa vào tỷ lệ ({operations.excludedTrips.length}):{" "}
							</span>
							{operations.excludedTrips
								.map((ex) => `${ex.title} (${EXCLUDED_TRIP_REASON_LABELS[ex.reason]})`)
								.join("; ")}
						</div>
					)}
				</div>
			</Card>

			<Card className="space-y-4 p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8efe8] pb-3">
					<div>
						<h2 className="text-base font-semibold text-[#10221b]">
							Chuyến sắp tới & đang diễn ra ({upcoming.tripCount})
						</h2>
						<p className="mt-0.5 text-xs text-[#526357]">
							Hiển thị tách biệt khỏi chỉ số hiệu quả. Số chỗ đã lấy bao gồm cả chỗ đang giữ chờ
							thanh toán.
						</p>
					</div>
					<span className="text-xs font-medium text-[#2c4234]">
						Tổng chỗ đã giữ: {upcoming.totalSeatsTaken}
						{upcoming.totalCapacityMax !== null ? ` / ${upcoming.totalCapacityMax}` : ""}
					</span>
				</div>

				<DataTable
					columns={upcomingColumns}
					rows={upcoming.trips}
					getRowKey={(t) => t.tripId}
					ariaLabel="Danh sách chuyến sắp tới và đang diễn ra"
					emptyMessage="Hiện không có chuyến sắp khởi hành hoặc đang diễn ra."
				/>
			</Card>
		</div>
	);
}
