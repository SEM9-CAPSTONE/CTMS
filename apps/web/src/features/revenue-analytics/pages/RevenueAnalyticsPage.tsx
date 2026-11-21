import { AlertCircle } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { Button, PageSkeleton, StatusBadge } from "../../../shared/components";
import { DEFAULT_REPORT_PERIOD } from "../../performance-reports/constants";
import { RevenueByTripTable } from "../components/RevenueByTripTable";
import { RevenueByAreaChart, RevenueTimeSeriesChart } from "../components/RevenueCharts";
import { RevenueFilterBar, granularityForPeriod } from "../components/RevenueFilterBar";
import { RevenueKpiCards } from "../components/RevenueKpiCards";
import { REVENUE_DEFAULT_ERROR, REVENUE_ERROR_MESSAGES } from "../constants";
import { useGeoAreas, useRevenueAnalytics } from "../hooks/useRevenueAnalytics";
import type { RevenueAnalyticsFilterParams } from "../types";

function errorMessage(error: unknown): string {
	if (error instanceof HttpError)
		return REVENUE_ERROR_MESSAGES[error.status] ?? REVENUE_DEFAULT_ERROR;
	return REVENUE_DEFAULT_ERROR;
}

export interface RevenueAnalyticsPageProps {
	/** Rendered as a tab inside "Báo cáo tổng quan": no outer padding, title becomes a sub-heading. */
	embedded?: boolean;
}

export const RevenueAnalyticsPage: React.FC<RevenueAnalyticsPageProps> = ({ embedded = false }) => {
	const Heading = embedded ? "h2" : "h1";
	const [filters, setFilters] = useState<RevenueAnalyticsFilterParams>({
		period: DEFAULT_REPORT_PERIOD,
		granularity: granularityForPeriod(DEFAULT_REPORT_PERIOD),
	});
	const { data, isLoading, isError, error, refetch, isFetching } = useRevenueAnalytics(filters);
	const { data: areas = [] } = useGeoAreas();

	if (isLoading) return <PageSkeleton />;

	return (
		<div className={`flex flex-col gap-6 ${embedded ? "" : "p-6"}`}>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<Heading
					className={`font-extrabold tracking-tight text-gray-900 ${embedded ? "text-lg" : "text-xl sm:text-2xl"}`}
				>
					Doanh thu theo thời gian và khu vực
				</Heading>
				<div className="flex flex-wrap items-center gap-2 self-start">
					{data?.scope && (
						<StatusBadge tone={data.scope.role === "admin" ? "info" : "success"}>
							{data.scope.role === "admin"
								? data.scope.hostId
									? "Một chủ chuyến"
									: "Toàn bộ chủ chuyến"
								: "Chuyến đi của bạn"}
						</StatusBadge>
					)}
				</div>
			</div>

			<RevenueFilterBar filters={filters} onChange={setFilters} areas={areas} hosts={data?.hosts} />

			{isError && (
				<div
					role="alert"
					className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800"
				>
					<AlertCircle className="size-5 shrink-0 text-rose-600" />
					<div className="flex-1">
						<p className="font-semibold">Không thể tải báo cáo doanh thu</p>
						<p className="mt-0.5 text-rose-700">{errorMessage(error)}</p>
					</div>
					<Button variant="secondary" size="sm" onClick={() => refetch()}>
						Thử lại
					</Button>
				</div>
			)}

			{!isError && data && (
				<div
					className={`flex flex-col gap-6 ${isFetching ? "opacity-70" : ""}`}
					aria-busy={isFetching}
				>
					<RevenueKpiCards kpis={data.kpis} />
					<div className="grid gap-6 xl:grid-cols-5">
						<div className="xl:col-span-3">
							<RevenueTimeSeriesChart
								points={data.timeSeries}
								granularity={data.granularity}
								showPayout={data.payoutAreaScoped}
							/>
						</div>
						<div className="xl:col-span-2">
							<RevenueByAreaChart areas={data.byArea} />
						</div>
					</div>
					<RevenueByTripTable trips={data.byTrip} />
				</div>
			)}
		</div>
	);
};
