import type React from "react";
import { useMemo } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card } from "../../../shared/components";
import type { BookingMetrics, PerformanceTrendPoint } from "../types";

export interface PerformanceChartsSectionProps {
	timeSeries: PerformanceTrendPoint[];
	fillRate?: number;
	cancellationRate?: number;
	bookingMetrics?: BookingMetrics;
	totalSeatsTaken?: number;
	totalCapacity?: number;
}

interface CustomTooltipProps {
	active?: boolean;
	payload?: Array<{
		name: string;
		value: number;
		color: string;
		dataKey: string;
	}>;
	label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
	if (!active || !payload || payload.length === 0) return null;

	const tripItem = payload.find((item) => item.dataKey === "tripCount");
	const bookingItem = payload.find((item) => item.dataKey === "bookingCount");

	return (
		<div className="flex flex-col gap-1.5 rounded-xl border border-gray-700/80 bg-gray-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-xs">
			<div className="border-b border-gray-700 pb-1 font-semibold text-gray-300">{label}</div>
			<div className="flex items-center justify-between gap-5 pt-0.5">
				<span className="flex items-center gap-1.5 text-gray-300">
					<span className="size-2 rounded-full bg-blue-500" />
					Chuyến đi:
				</span>
				<span className="font-bold text-white">{tripItem?.value ?? 0}</span>
			</div>
			<div className="flex items-center justify-between gap-5">
				<span className="flex items-center gap-1.5 text-gray-300">
					<span className="size-2 rounded-full bg-emerald-500" />
					Đơn đặt:
				</span>
				<span className="font-bold text-white">{bookingItem?.value ?? 0}</span>
			</div>
		</div>
	);
};

export const PerformanceChartsSection: React.FC<PerformanceChartsSectionProps> = ({
	timeSeries,
	fillRate = 0,
	cancellationRate = 0,
	bookingMetrics,
	totalSeatsTaken,
	totalCapacity,
}) => {
	// Donut chart calculations
	const safeFill = Math.min(100, Math.max(0, fillRate));
	const safeCancel = Math.min(100 - safeFill, Math.max(0, cancellationRate));
	const safeRemaining = Number(Math.max(0, 100 - safeFill - safeCancel).toFixed(1));

	// SVG Circle parameters (r = 54 => Circumference ~ 339.292)
	const radius = 54;
	const circumference = 2 * Math.PI * radius;
	const fillStroke = (safeFill / 100) * circumference;
	const cancelStroke = (safeCancel / 100) * circumference;
	const remainingStroke = (safeRemaining / 100) * circumference;

	const fillOffset = 0;
	const cancelOffset = -fillStroke;
	const remainingOffset = -(fillStroke + cancelStroke);

	// Format data for Recharts AreaChart
	const chartData = useMemo(() => {
		if (!timeSeries || timeSeries.length === 0) return [];
		return timeSeries.map((p) => ({
			rawDate: p.date,
			date: p.date.slice(5).replace("-", "/"), // e.g. "10/14", "11/11"
			fullDate: p.date,
			tripCount: p.tripCount,
			bookingCount: p.bookingCount,
		}));
	}, [timeSeries]);

	if (!timeSeries || timeSeries.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{/* Biểu đồ xu hướng đặt chỗ theo ngày dạng Recharts Smooth Area */}
			<Card className="flex flex-col p-5">
				<div className="flex flex-col gap-2 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
					<h3 className="text-sm font-bold text-gray-900">Xu hướng đặt chỗ theo ngày</h3>
					<div className="flex flex-wrap items-center gap-4 text-xs">
						<span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
							<span className="size-2 rounded-full bg-blue-500" />
							<span>Chuyến đi</span>
						</span>
						<span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
							<span className="size-2 rounded-full bg-emerald-500" />
							<span>Đơn đặt</span>
						</span>
					</div>
				</div>

				<div className="mt-4 h-72 w-full cursor-pointer">
					<ResponsiveContainer width="100%" height={260} minHeight={200}>
						<AreaChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
							<defs>
								<linearGradient id="areaTripGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
									<stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
								</linearGradient>
								<linearGradient id="areaBookingGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
									<stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
								</linearGradient>
							</defs>

							<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={{ stroke: "#e2e8f0" }}
								tick={{ fill: "#64748b", fontSize: 11 }}
								dy={6}
							/>

							<YAxis
								tickLine={false}
								axisLine={false}
								tick={{ fill: "#64748b", fontSize: 11 }}
								allowDecimals={false}
							/>

							<Tooltip
								content={<CustomTooltip />}
								cursor={{ stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "3 3" }}
							/>

							{/* Area chuyến đi */}
							<Area
								type="monotone"
								dataKey="tripCount"
								name="Chuyến đi"
								stroke="#3b82f6"
								strokeWidth={2.5}
								fillOpacity={1}
								fill="url(#areaTripGrad)"
								activeDot={{
									r: 5,
									fill: "#ffffff",
									stroke: "#3b82f6",
									strokeWidth: 2.5,
								}}
							/>

							{/* Area đơn đặt */}
							<Area
								type="monotone"
								dataKey="bookingCount"
								name="Đơn đặt"
								stroke="#10b981"
								strokeWidth={2.5}
								fillOpacity={1}
								fill="url(#areaBookingGrad)"
								activeDot={{
									r: 5,
									fill: "#ffffff",
									stroke: "#10b981",
									strokeWidth: 2.5,
								}}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</Card>

			{/* Biểu đồ tròn Tỷ lệ lấp đầy & Hủy chỗ */}
			<Card className="flex flex-col p-5">
				<div className="flex items-center justify-between border-b border-gray-100 pb-3">
					<h3 className="text-sm font-bold text-gray-900">Tỷ lệ lấp đầy & Hủy chỗ (%)</h3>
					<div className="flex items-center gap-3 text-xs text-gray-500">
						<span className="inline-flex items-center gap-1">
							<span className="size-2 rounded-full bg-indigo-600" /> Lấp đầy
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="size-2 rounded-full bg-rose-500" /> Hủy
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="size-2 rounded-full bg-slate-300" /> Còn trống
						</span>
					</div>
				</div>

				<div className="mt-4 flex h-72 flex-col items-center justify-around gap-6 sm:flex-row">
					{/* SVG Donut Chart */}
					<div className="relative flex size-48 shrink-0 items-center justify-center">
						<svg
							className="size-full -rotate-90 transform"
							viewBox="0 0 140 140"
							aria-label="Biểu đồ tròn tỷ lệ lấp đầy và hủy chỗ"
						>
							{/* Background Track */}
							<circle
								cx="70"
								cy="70"
								r={radius}
								className="fill-none stroke-gray-100"
								strokeWidth="16"
							/>
							{/* Remaining / Available Segment */}
							{safeRemaining > 0 && (
								<circle
									cx="70"
									cy="70"
									r={radius}
									className="fill-none stroke-slate-200 transition-all duration-500"
									strokeWidth="16"
									strokeDasharray={`${remainingStroke} ${circumference}`}
									strokeDashoffset={remainingOffset}
								/>
							)}
							{/* Cancelled Segment */}
							{safeCancel > 0 && (
								<circle
									cx="70"
									cy="70"
									r={radius}
									className="fill-none stroke-rose-500 transition-all duration-500"
									strokeWidth="16"
									strokeDasharray={`${cancelStroke} ${circumference}`}
									strokeDashoffset={cancelOffset}
								/>
							)}
							{/* Filled Segment */}
							{safeFill > 0 && (
								<circle
									cx="70"
									cy="70"
									r={radius}
									className="fill-none stroke-indigo-600 transition-all duration-500"
									strokeWidth="16"
									strokeDasharray={`${fillStroke} ${circumference}`}
									strokeDashoffset={fillOffset}
								/>
							)}
						</svg>

						{/* Center Metrics in Donut */}
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<span className="text-2xl font-black tracking-tight text-gray-900">{safeFill}%</span>
							<span className="text-[11px] font-medium text-gray-500">Lấp đầy</span>
						</div>
					</div>

					{/* Detailed Legend Info */}
					<div className="flex flex-col justify-center gap-3.5 text-xs">
						{/* Đã lấp đầy */}
						<div className="flex items-start gap-2.5">
							<span className="mt-1 size-2.5 shrink-0 rounded-full bg-indigo-600" />
							<div className="flex flex-col">
								<div className="flex items-baseline gap-1.5">
									<span className="font-semibold text-gray-900">Đã lấp đầy</span>
									<span className="font-bold text-indigo-600">{safeFill}%</span>
								</div>
								{totalSeatsTaken !== undefined &&
									totalCapacity !== undefined &&
									totalCapacity > 0 && (
										<span className="text-[11px] text-gray-500">
											{totalSeatsTaken} / {totalCapacity} chỗ đã đặt
										</span>
									)}
							</div>
						</div>

						{/* Đã hủy */}
						<div className="flex items-start gap-2.5">
							<span className="mt-1 size-2.5 shrink-0 rounded-full bg-rose-500" />
							<div className="flex flex-col">
								<div className="flex items-baseline gap-1.5">
									<span className="font-semibold text-gray-900">Đã hủy</span>
									<span className="font-bold text-rose-600">{safeCancel}%</span>
								</div>
								{bookingMetrics && (
									<span className="text-[11px] text-gray-500">
										{bookingMetrics.cancelled} / {bookingMetrics.total} đơn hủy
									</span>
								)}
							</div>
						</div>

						{/* Còn trống / Khả dụng */}
						<div className="flex items-start gap-2.5">
							<span className="mt-1 size-2.5 shrink-0 rounded-full bg-slate-300" />
							<div className="flex flex-col">
								<div className="flex items-baseline gap-1.5">
									<span className="font-semibold text-gray-900">Còn trống / Khả dụng</span>
									<span className="font-bold text-slate-600">{safeRemaining}%</span>
								</div>
								{totalSeatsTaken !== undefined &&
									totalCapacity !== undefined &&
									totalCapacity > 0 && (
										<span className="text-[11px] text-gray-500">
											{Math.max(0, totalCapacity - totalSeatsTaken)} chỗ chưa đặt
										</span>
									)}
							</div>
						</div>
					</div>
				</div>
			</Card>
		</div>
	);
};
