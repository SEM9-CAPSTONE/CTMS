import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatusBadge } from "../../../shared/components";
import { formatMonthVi } from "../constants";
import type { HostSeasonality } from "../types";

export interface HostSeasonalityChartProps {
	seasonality: HostSeasonality;
}

export function HostSeasonalityChart({ seasonality }: HostSeasonalityChartProps) {
	const missingMonths = Math.max(0, 12 - seasonality.historySpanMonths);
	const chartData = seasonality.trend.map((point) => ({
		month: point.month,
		label: `${point.month.slice(5)}/${point.month.slice(2, 4)}`,
		tripCount: point.tripCount,
		totalGuests: point.totalGuests,
		fillRate: point.fillRate,
	}));

	return (
		<Card className="space-y-4 p-5">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8efe8] pb-3">
				<div>
					<h2 className="text-base font-semibold text-[#10221b]">
						Xu hướng hoạt động theo tháng khởi hành
					</h2>
					<p className="mt-0.5 text-xs text-[#526357]">
						Tính trên toàn bộ lịch sử chuyến đã hoàn thành của bạn (không giới hạn theo bộ lọc ngày
						đang chọn).
					</p>
				</div>
				<StatusBadge tone={seasonality.status === "ok" ? "success" : "neutral"}>
					{seasonality.status === "ok"
						? `Đủ ${seasonality.historySpanMonths} tháng lịch sử`
						: `Cần thêm ${missingMonths} tháng lịch sử`}
				</StatusBadge>
			</div>

			{seasonality.status === "insufficient_history" && (
				<p className="rounded-lg bg-[#f6f9f6] px-3.5 py-2.5 text-xs text-[#435649]">
					Hệ thống hiện ghi nhận khoảng thời gian lịch sử {seasonality.historySpanMonths} tháng. Cần
					thêm {missingMonths} tháng nữa (đủ ít nhất 12 tháng từ chuyến đầu tiên đến chuyến gần
					nhất) để xác định các tháng cao điểm và thấp điểm.
				</p>
			)}

			{chartData.length === 0 ? (
				<p className="py-8 text-center text-sm text-[#647468]">
					Chưa có chuyến đã hoàn thành để hiển thị biểu đồ xu hướng theo tháng.
				</p>
			) : (
				<div className="h-64 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e5ede5" />
							<XAxis dataKey="label" tick={{ fontSize: 12, fill: "#526357" }} />
							<YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#526357" }} />
							<Tooltip
								formatter={(value, name) => {
									if (name === "tripCount")
										return [`${String(value)} chuyến`, "Số chuyến hoàn thành"];
									return [`${String(value)} khách`, "Tổng lượt khách"];
								}}
								labelFormatter={(label) => `Tháng ${String(label)}`}
							/>
							<Bar dataKey="tripCount" fill="#164027" radius={[4, 4, 0, 0]} maxBarSize={36} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{seasonality.status === "ok" && (
				<div className="grid grid-cols-1 gap-3 border-t border-[#e8efe8] pt-3 sm:grid-cols-2">
					<div>
						<p className="text-xs font-medium text-[#526357]">
							Tháng hoạt động cao nhất trong lịch sử
						</p>
						<p className="mt-1 text-sm font-semibold text-[#164027]">
							{seasonality.highestMonths && seasonality.highestMonths.length > 0
								? seasonality.highestMonths.map(formatMonthVi).join(", ")
								: "Chưa xác định"}
						</p>
					</div>
					<div>
						<p className="text-xs font-medium text-[#526357]">Tháng ít chuyến nhất trong lịch sử</p>
						<p className="mt-1 text-sm font-semibold text-[#435649]">
							{seasonality.lowestMonths && seasonality.lowestMonths.length > 0
								? seasonality.lowestMonths.map(formatMonthVi).join(", ")
								: "Chưa xác định"}
						</p>
					</div>
				</div>
			)}
		</Card>
	);
}
