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
		<Card className="flex h-full flex-col justify-between space-y-4 p-5">
			<div className="space-y-1.5 border-b border-[#e8efe8] pb-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-bold text-gray-900">Xu hướng chuyến theo tháng</h2>
					<StatusBadge tone={seasonality.status === "ok" ? "success" : "neutral"}>
						{seasonality.status === "ok"
							? `${seasonality.historySpanMonths} tháng lịch sử`
							: `Cần thêm ${missingMonths} tháng lịch sử`}
					</StatusBadge>
				</div>
				<p className="text-xs text-gray-500">Số chuyến đã hoàn thành theo tháng khởi hành</p>
			</div>

			{chartData.length === 0 ? (
				<p className="py-12 text-center text-sm text-gray-500">
					Chưa có chuyến hoàn thành để hiển thị biểu đồ.
				</p>
			) : (
				<div className="h-56 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e5ede5" vertical={false} />
							<XAxis dataKey="label" tick={{ fontSize: 11, fill: "#526357" }} />
							<YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#526357" }} />
							<Tooltip
								formatter={(value) => [`${String(value)} chuyến`, "Chuyến hoàn thành"]}
								labelFormatter={(label) => `Tháng ${String(label)}`}
							/>
							<Bar dataKey="tripCount" fill="#164027" radius={[6, 6, 0, 0]} maxBarSize={32} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{seasonality.status === "ok" && (
				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8efe8] pt-3 text-xs text-gray-600">
					{seasonality.highestMonths && seasonality.highestMonths.length > 0 && (
						<span>
							Cao điểm:{" "}
							<strong className="font-semibold text-[#164027]">
								{seasonality.highestMonths.map(formatMonthVi).join(", ")}
							</strong>
						</span>
					)}
					{seasonality.lowestMonths && seasonality.lowestMonths.length > 0 && (
						<span>
							Thấp điểm:{" "}
							<strong className="font-semibold text-gray-800">
								{seasonality.lowestMonths.map(formatMonthVi).join(", ")}
							</strong>
						</span>
					)}
				</div>
			)}
		</Card>
	);
}
