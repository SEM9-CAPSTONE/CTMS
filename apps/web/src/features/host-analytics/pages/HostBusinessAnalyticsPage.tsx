import { useCallback, useMemo, useState } from "react";
import { Button, PageSkeleton } from "../../../shared/components";
import { useGeoAreas } from "../../revenue-analytics/hooks/useRevenueAnalytics";
import { HostAnalyticsFilterBar } from "../components/HostAnalyticsFilterBar";
import { HostAnalyticsKpiGroups } from "../components/HostAnalyticsKpiGroups";
import { HostOperationsBreakdown } from "../components/HostOperationsBreakdown";
import { HostSuggestionsSection } from "../components/HostSuggestionsSection";
import { resolveVietnamPresetRange, vietnamDateToIsoBoundary } from "../constants";
import { useHostAnalytics } from "../hooks/useHostAnalytics";
import { useHostSuggestions } from "../hooks/useHostSuggestions";
import type { HostAnalyticsPeriodPreset } from "../types";

export interface HostBusinessAnalyticsPageProps {
	actor: string;
	onNavigate: (path: string) => void;
}

export function HostBusinessAnalyticsPage({ actor, onNavigate }: HostBusinessAnalyticsPageProps) {
	const initialRange = useMemo(() => resolveVietnamPresetRange("12m"), []);
	const [preset, setPreset] = useState<HostAnalyticsPeriodPreset>("12m");
	const [fromDate, setFromDate] = useState(initialRange.fromDate);
	const [toDate, setToDate] = useState(initialRange.toDate);
	const [areaCode, setAreaCode] = useState("");

	const queryParams = useMemo(
		() => ({
			from: vietnamDateToIsoBoundary(fromDate, "start"),
			to: vietnamDateToIsoBoundary(toDate, "end"),
			areaCode: areaCode || undefined,
		}),
		[fromDate, toDate, areaCode]
	);

	const geoAreasQuery = useGeoAreas();
	const analyticsQuery = useHostAnalytics(actor, queryParams);
	const suggestions = useHostSuggestions(actor, onNavigate);

	const handleSelectPreset = useCallback((next: Exclude<HostAnalyticsPeriodPreset, "custom">) => {
		const range = resolveVietnamPresetRange(next);
		setPreset(next);
		setFromDate(range.fromDate);
		setToDate(range.toDate);
	}, []);

	const handleCustomDates = useCallback((nextFrom: string, nextTo: string) => {
		setPreset("custom");
		setFromDate(nextFrom);
		setToDate(nextTo);
	}, []);

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="sticky top-[65px] z-20 border-b border-[#dfe8df] bg-white lg:top-0">
				<div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
					<h1 className="text-xl font-bold tracking-tight text-[#10221b] sm:text-2xl">
						Hiệu quả & Gợi ý mở chuyến
					</h1>
				</div>
			</header>

			<div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
				<HostAnalyticsFilterBar
					preset={preset}
					fromDate={fromDate}
					toDate={toDate}
					areaCode={areaCode}
					areas={geoAreasQuery.data ?? []}
					isFetching={analyticsQuery.isFetching}
					onSelectPreset={handleSelectPreset}
					onChangeCustomDates={handleCustomDates}
					onChangeArea={setAreaCode}
					onRefresh={() => {
						void analyticsQuery.refetch();
					}}
				/>

				{analyticsQuery.isPending ? (
					<PageSkeleton />
				) : analyticsQuery.isError ? (
					<div className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 text-center">
						<p className="text-sm font-medium text-rose-700">
							Không tải được dữ liệu phân tích lúc này.
						</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-3"
							onClick={() => void analyticsQuery.refetch()}
						>
							Thử lại
						</Button>
					</div>
				) : analyticsQuery.data ? (
					<div
						className={`flex flex-col gap-6 ${analyticsQuery.isFetching ? "opacity-80" : ""}`}
						aria-busy={analyticsQuery.isFetching}
					>
						<HostAnalyticsKpiGroups data={analyticsQuery.data} />

						<HostSuggestionsSection
							job={suggestions.job}
							history={suggestions.history}
							leadTimeMedianDays={analyticsQuery.data.leadTime.medianDays}
							isLoading={suggestions.isLoading}
							isPolling={suggestions.isPolling}
							isCreating={suggestions.isCreating}
							waitSeconds={suggestions.waitSeconds}
							activeConflict={suggestions.activeConflict}
							quickCreateBusyId={suggestions.quickCreateBusyId}
							onCreateJob={() => suggestions.createJob(queryParams)}
							onInspectConflictJob={suggestions.inspectConflictJob}
							onQuickCreate={(id) => void suggestions.openQuickCreate(id)}
						/>

						<HostOperationsBreakdown
							operations={analyticsQuery.data.operations}
							upcoming={analyticsQuery.data.upcoming}
							seasonality={analyticsQuery.data.seasonality}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
