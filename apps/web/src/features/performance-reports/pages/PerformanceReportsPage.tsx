import { AlertCircle } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button, PageSkeleton, StatusBadge } from "../../../shared/components";
import { PerformanceBreakdownTable } from "../components/PerformanceBreakdownTable";
import { PerformanceChartsSection } from "../components/PerformanceChartsSection";
import { PerformanceFilterBar } from "../components/PerformanceFilterBar";
import { PerformanceMetricsCards } from "../components/PerformanceMetricsCards";
import { DEFAULT_REPORT_PERIOD } from "../constants";
import { usePerformanceReport } from "../hooks/usePerformanceReport";
import type { PerformanceReportFilterParams } from "../types";

export const PerformanceReportsPage: React.FC = () => {
	const [filters, setFilters] = useState<PerformanceReportFilterParams>({
		period: DEFAULT_REPORT_PERIOD,
	});

	const { data, isLoading, isError, error, refetch } = usePerformanceReport(filters);

	if (isLoading) {
		return <PageSkeleton />;
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			{/* Page Header */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
					Báo cáo hiệu suất hoạt động
				</h1>
				{data?.scope && (
					<div className="self-start sm:self-auto">
						<StatusBadge tone={data.scope.role === "admin" ? "info" : "success"}>
							{data.scope.role === "admin"
								? "Toàn bộ hệ thống (Admin)"
								: "Phạm vi chuyến của bạn (Host)"}
						</StatusBadge>
					</div>
				)}
			</div>

			{/* Filter Bar */}
			<PerformanceFilterBar filters={filters} onChange={setFilters} />

			{/* Error State */}
			{isError && (
				<div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800">
					<AlertCircle className="size-5 shrink-0 text-rose-600" />
					<div className="flex-1">
						<p className="font-semibold">Không thể tải dữ liệu báo cáo</p>
						<p className="mt-0.5 text-rose-700">
							{error instanceof Error
								? error.message
								: "Vui lòng kiểm tra quyền hoặc kết nối mạng."}
						</p>
					</div>
					<Button variant="secondary" size="sm" onClick={() => refetch()}>
						Thử lại
					</Button>
				</div>
			)}

			{/* Loaded Report Content */}
			{!isError && data && (
				<>
					{/* 6 Key Metric Cards */}
					<PerformanceMetricsCards data={data} />

					{/* Charts Section */}
					<PerformanceChartsSection
						timeSeries={data.timeSeries}
						fillRate={data.fillRate}
						cancellationRate={data.cancellationRate}
						bookingMetrics={data.bookings}
						totalSeatsTaken={data.breakdown.reduce((sum, item) => sum + item.seatsTaken, 0)}
						totalCapacity={data.breakdown.reduce((sum, item) => sum + item.capacity, 0)}
					/>

					{/* Breakdown Table */}
					<PerformanceBreakdownTable items={data.breakdown} />
				</>
			)}
		</div>
	);
};
