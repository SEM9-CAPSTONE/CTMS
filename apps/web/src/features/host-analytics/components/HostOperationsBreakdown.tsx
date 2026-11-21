import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import { formatMonthVi, formatShortDateVi } from "../constants";
import type {
	HostOperationsMetrics,
	HostSeasonality,
	HostUpcomingBlock,
	OperationsAreaBreakdown,
	OperationsRouteBreakdown,
	OperationsTripBreakdown,
	UpcomingTripSummary,
} from "../types";

type BreakdownTab = "seasonality" | "route" | "area" | "trip" | "upcoming";

export interface HostOperationsBreakdownProps {
	operations: HostOperationsMetrics;
	upcoming: HostUpcomingBlock;
	seasonality: HostSeasonality;
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
		header: "Tỷ lệ kín chỗ",
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
		header: "Tỷ lệ kín chỗ",
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
		header: "Kín chỗ",
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

export function HostOperationsBreakdown({
	operations,
	upcoming,
	seasonality,
}: HostOperationsBreakdownProps) {
	const [tab, setTab] = useState<BreakdownTab>("seasonality");
	const [showAll, setShowAll] = useState(false);

	const missingMonths = Math.max(0, 12 - seasonality.historySpanMonths);
	const chartData = seasonality.trend.map((point) => ({
		month: point.month,
		label: `${point.month.slice(5)}/${point.month.slice(2, 4)}`,
		tripCount: point.tripCount,
		totalGuests: point.totalGuests,
		fillRate: point.fillRate,
	}));

	const activeCount =
		tab === "seasonality"
			? 0
			: tab === "route"
				? operations.byRoute.length
				: tab === "area"
					? operations.byArea.length
					: tab === "trip"
						? operations.byTrip.length
						: upcoming.trips.length;

	return (
		<Card className="space-y-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8efe8] pb-3.5">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-base font-bold text-gray-900">Xu hướng & Phân tích chi tiết</h2>
					<StatusBadge tone={seasonality.status === "ok" ? "success" : "neutral"}>
						{seasonality.status === "ok"
							? `${seasonality.historySpanMonths} tháng lịch sử`
							: `Cần thêm ${missingMonths} tháng lịch sử`}
					</StatusBadge>
				</div>

				<div
					className="flex flex-wrap items-center gap-1.5"
					role="tablist"
					aria-label="Phân nhóm vận hành"
				>
					{(
						[
							{ key: "seasonality", label: "Biểu đồ xu hướng" },
							{ key: "route", label: `Theo tuyến (${operations.byRoute.length})` },
							{ key: "area", label: `Theo khu vực (${operations.byArea.length})` },
							{ key: "trip", label: `Theo chuyến (${operations.byTrip.length})` },
							{ key: "upcoming", label: `Sắp tới (${upcoming.tripCount})` },
						] as const
					).map((item) => (
						<button
							key={item.key}
							type="button"
							role="tab"
							aria-selected={tab === item.key}
							onClick={() => {
								setTab(item.key);
								setShowAll(false);
							}}
							className={`min-h-8 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
								tab === item.key
									? "bg-[#164027] text-white shadow-xs"
									: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2] hover:text-[#164027]"
							}`}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>

			{tab === "seasonality" && (
				<div className="space-y-3">
					{chartData.length === 0 ? (
						<p className="py-10 text-center text-sm text-gray-500">
							Chưa có chuyến hoàn thành để hiển thị biểu đồ.
						</p>
					) : (
						<div className="h-60 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#e5ede5" vertical={false} />
									<XAxis dataKey="label" tick={{ fontSize: 12, fill: "#526357" }} />
									<YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#526357" }} />
									<Tooltip
										formatter={(value) => [`${String(value)} chuyến`, "Chuyến hoàn thành"]}
										labelFormatter={(label) => `Tháng ${String(label)}`}
									/>
									<Bar dataKey="tripCount" fill="#164027" radius={[6, 6, 0, 0]} maxBarSize={40} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					)}

					{seasonality.status === "ok" && (
						<div className="flex flex-wrap items-center gap-6 border-t border-[#e8efe8] pt-2.5 text-xs text-gray-600">
							{seasonality.highestMonths && seasonality.highestMonths.length > 0 && (
								<span>
									Tháng cao điểm:{" "}
									<strong className="font-semibold text-[#164027]">
										{seasonality.highestMonths.map(formatMonthVi).join(", ")}
									</strong>
								</span>
							)}
							{seasonality.lowestMonths && seasonality.lowestMonths.length > 0 && (
								<span>
									Tháng thấp điểm:{" "}
									<strong className="font-semibold text-gray-800">
										{seasonality.lowestMonths.map(formatMonthVi).join(", ")}
									</strong>
								</span>
							)}
						</div>
					)}
				</div>
			)}

			{tab === "route" && (
				<DataTable
					columns={routeColumns}
					rows={showAll ? operations.byRoute : operations.byRoute.slice(0, 5)}
					getRowKey={(r) => r.routeId}
					ariaLabel="Chi tiết vận hành theo tuyến"
					emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
				/>
			)}
			{tab === "area" && (
				<DataTable
					columns={areaColumns}
					rows={showAll ? operations.byArea : operations.byArea.slice(0, 5)}
					getRowKey={(a) => a.areaCode ?? "unknown"}
					ariaLabel="Chi tiết vận hành theo khu vực"
					emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
				/>
			)}
			{tab === "trip" && (
				<DataTable
					columns={tripColumns}
					rows={showAll ? operations.byTrip : operations.byTrip.slice(0, 5)}
					getRowKey={(t) => t.tripId}
					ariaLabel="Chi tiết vận hành theo chuyến"
					emptyMessage="Chưa có chuyến hoàn thành trong kỳ này."
				/>
			)}
			{tab === "upcoming" && (
				<DataTable
					columns={upcomingColumns}
					rows={showAll ? upcoming.trips : upcoming.trips.slice(0, 5)}
					getRowKey={(t) => t.tripId}
					ariaLabel="Danh sách chuyến sắp tới và đang diễn ra"
					emptyMessage="Hiện không có chuyến sắp khởi hành hoặc đang diễn ra."
				/>
			)}

			{activeCount > 5 && (
				<div className="flex justify-center border-t border-[#e8efe8] pt-2.5">
					<button
						type="button"
						onClick={() => setShowAll((prev) => !prev)}
						className="text-xs font-semibold text-[#164027] hover:underline"
					>
						{showAll ? "Thu gọn danh sách" : `Xem tất cả (${activeCount})`}
					</button>
				</div>
			)}
		</Card>
	);
}
