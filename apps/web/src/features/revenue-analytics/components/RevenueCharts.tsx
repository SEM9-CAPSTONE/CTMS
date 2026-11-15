import type React from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card } from "../../../shared/components";
import { formatVnd, formatVndCompact } from "../../../shared/utils/money";
import { UNKNOWN_AREA_LABEL } from "../constants";
import type { RevenueAreaBreakdown, RevenueGranularity, RevenueTimeSeriesPoint } from "../types";

const shareFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** Vietnamese percent, for example "71,4%". */
export function formatShare(percent: number): string {
	return `${shareFormatter.format(percent)}%`;
}

export function formatBucketLabel(bucket: string, granularity: RevenueGranularity): string {
	const [year, month, day] = bucket.split("-");
	if (granularity === "month") return `Th${Number(month)}/${year}`;
	return `${day}/${month}`;
}

const SERIES = [
	{ key: "grossRevenue", name: "Tổng tiền khách trả", color: "#3b82f6", dot: "bg-blue-500" },
	{ key: "netRevenue", name: "Thu nhập sau phí", color: "#10b981", dot: "bg-emerald-500" },
	{ key: "payout", name: "Đã rút về ngân hàng", color: "#f59e0b", dot: "bg-amber-500" },
] as const;

interface TrendTooltipProps {
	active?: boolean;
	payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
	label?: string;
}

const TrendTooltip: React.FC<TrendTooltipProps> = ({ active, payload, label }) => {
	if (!active || !payload || payload.length === 0) return null;
	return (
		<div className="flex flex-col gap-1.5 rounded-xl border border-gray-700/80 bg-gray-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-xs">
			<div className="border-b border-gray-700 pb-1 font-semibold text-gray-300">{label}</div>
			{payload.map((item) => (
				<div key={item.dataKey} className="flex items-center justify-between gap-5">
					<span className="flex items-center gap-1.5 text-gray-300">
						<span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
						{item.name}:
					</span>
					<span className="font-bold text-white">{formatVnd(Number(item.value))}</span>
				</div>
			))}
		</div>
	);
};

interface RevenueTimeSeriesChartProps {
	points: RevenueTimeSeriesPoint[];
	granularity: RevenueGranularity;
	showPayout: boolean;
}

export const RevenueTimeSeriesChart: React.FC<RevenueTimeSeriesChartProps> = ({
	points,
	granularity,
	showPayout,
}) => {
	const data = points.map((point) => ({
		...point,
		label: formatBucketLabel(point.bucket, granularity),
	}));
	const series = SERIES.filter((item) => showPayout || item.key !== "payout");

	return (
		<Card className="flex flex-col p-5">
			<div className="flex flex-col gap-2 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
				<h3 className="text-sm font-bold text-gray-900">Doanh thu theo thời gian</h3>
				<div className="flex flex-wrap items-center gap-4 text-xs">
					{series.map((item) => (
						<span
							key={item.key}
							className="inline-flex items-center gap-1.5 font-medium text-gray-700"
						>
							<span className={`size-2 rounded-full ${item.dot}`} />
							<span>{item.name}</span>
						</span>
					))}
				</div>
			</div>

			<div className="mt-4 h-72 w-full" role="img" aria-label="Biểu đồ doanh thu theo thời gian">
				<ResponsiveContainer width="100%" height={260} minHeight={200}>
					<AreaChart data={data} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
						<defs>
							{series.map((item) => (
								<linearGradient
									key={item.key}
									id={`revenue-grad-${item.key}`}
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop offset="5%" stopColor={item.color} stopOpacity={0.25} />
									<stop offset="95%" stopColor={item.color} stopOpacity={0} />
								</linearGradient>
							))}
						</defs>
						<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={{ stroke: "#e2e8f0" }}
							tick={{ fill: "#64748b", fontSize: 11 }}
							dy={6}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={56}
							tick={{ fill: "#64748b", fontSize: 11 }}
							tickFormatter={(value: number) => formatVndCompact(value)}
						/>
						<Tooltip
							content={<TrendTooltip />}
							cursor={{ stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "3 3" }}
						/>
						{series.map((item) => (
							<Area
								key={item.key}
								type="monotone"
								dataKey={item.key}
								name={item.name}
								stroke={item.color}
								strokeWidth={2.5}
								fillOpacity={1}
								fill={`url(#revenue-grad-${item.key})`}
								activeDot={{ r: 5, fill: "#ffffff", stroke: item.color, strokeWidth: 2.5 }}
							/>
						))}
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</Card>
	);
};

interface RevenueByAreaChartProps {
	areas: RevenueAreaBreakdown[];
}

export const RevenueByAreaChart: React.FC<RevenueByAreaChartProps> = ({ areas }) => {
	const data = areas.map((area) => ({
		...area,
		label: area.areaName ?? UNKNOWN_AREA_LABEL,
	}));

	return (
		<Card className="flex flex-col gap-3 p-5">
			<h3 className="text-sm font-bold text-gray-900">Doanh thu theo khu vực</h3>
			{data.length === 0 ? (
				<p className="py-10 text-center text-xs text-[#7b8c82]">
					Chưa có doanh thu trong kỳ đã chọn.
				</p>
			) : (
				<>
					<div
						className="w-full"
						style={{ height: Math.max(160, data.length * 44) }}
						role="img"
						aria-label="Biểu đồ doanh thu theo khu vực"
					>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								data={data}
								layout="vertical"
								margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
							>
								<CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eee8" />
								<XAxis
									type="number"
									tick={{ fontSize: 11 }}
									tickFormatter={(value: number) => formatVndCompact(value)}
								/>
								<YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
								<Tooltip formatter={(value) => formatVnd(Number(value))} />
								<Bar
									dataKey="grossRevenue"
									name="Tổng tiền khách trả"
									fill="#9cc5a1"
									radius={[0, 4, 4, 0]}
								/>
								<Bar
									dataKey="netRevenue"
									name="Thu nhập sau phí"
									fill="#164027"
									radius={[0, 4, 4, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<ul className="flex flex-col gap-1.5 text-xs">
						{data.map((area) => (
							<li
								key={area.areaCode ?? "unknown"}
								className="flex items-center justify-between gap-3"
							>
								<span className="text-[#55685a]">
									{area.label} · {area.tripCount} chuyến
								</span>
								<span className="font-semibold text-gray-900">
									Chiếm {formatShare(area.grossShare)}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</Card>
	);
};
