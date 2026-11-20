import { useCallback, useMemo, useState } from "react";
import { Button, PageSkeleton } from "../../../shared/components";
import { useGeoAreas } from "../../revenue-analytics/hooks/useRevenueAnalytics";
import { HostAnalyticsFilterBar } from "../components/HostAnalyticsFilterBar";
import { HostAnalyticsKpiGroups } from "../components/HostAnalyticsKpiGroups";
import { HostOperationsBreakdown } from "../components/HostOperationsBreakdown";
import { HostSeasonalityChart } from "../components/HostSeasonalityChart";
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
						Phân tích kinh doanh & Gợi ý chuyến đi
					</h1>
				</div>
			</header>

			<div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
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
					<div className="rounded-xl border border-red-200 bg-white p-6 text-center">
						<p className="text-sm font-medium text-red-700">
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
					<>
						<HostAnalyticsKpiGroups data={analyticsQuery.data} />
						<HostSeasonalityChart seasonality={analyticsQuery.data.seasonality} />
						<HostSuggestionsSection
							job={suggestions.job}
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
						/>
					</>
				) : null}
			</div>
		</div>
	);
}
