import { Suspense, lazy, useCallback, useMemo, useState } from "react";
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

const LazyDemandInsightsPage = lazy(() =>
	import("../../demand-insights/DemandInsightsPage").then((m) => ({
		default: m.DemandInsightsPage,
	}))
);

type AnalyticsPageTab = "business" | "market";

function readInitialTab(): AnalyticsPageTab {
	if (typeof window === "undefined") return "business";
	const tab = new URLSearchParams(window.location.search).get("tab");
	return tab === "market" ? "market" : "business";
}

export interface HostBusinessAnalyticsPageProps {
	actor: string;
	onNavigate: (path: string) => void;
}

export function HostBusinessAnalyticsPage({ actor, onNavigate }: HostBusinessAnalyticsPageProps) {
	const [activeTab, setActiveTab] = useState<AnalyticsPageTab>(readInitialTab);
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
	const analyticsQuery = useHostAnalytics(activeTab === "business" ? actor : "", queryParams);
	const suggestions = useHostSuggestions(activeTab === "business" ? actor : "", onNavigate);

	const switchTab = useCallback((next: AnalyticsPageTab) => {
		setActiveTab(next);
		if (typeof window !== "undefined") {
			const url = new URL(window.location.href);
			if (next === "market") {
				url.searchParams.set("tab", "market");
			} else {
				url.searchParams.delete("tab");
			}
			window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
		}
	}, []);

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
			<div className="border-b border-[#dfe8df] bg-white">
				<div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
					{activeTab === "business" ? (
						<div>
							<h1 className="text-xl font-bold tracking-tight text-[#10221b] sm:text-2xl">
								Phân tích kinh doanh & Gợi ý chuyến đi
							</h1>
							<p className="mt-0.5 text-xs text-[#526357]">
								Theo dõi hiệu quả chuyến đi của bạn, xu hướng theo tháng và gợi ý mở chuyến mới.
							</p>
						</div>
					) : (
						<p className="text-xs font-medium text-[#526357]">Chuyển chế độ xem phân tích</p>
					)}

					<div
						className="flex items-center gap-1.5"
						role="tablist"
						aria-label="Chế độ xem phân tích"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "business"}
							onClick={() => switchTab("business")}
							className={
								activeTab === "business"
									? "rounded-full bg-[#164027] px-4 py-1.5 text-xs font-semibold text-white"
									: "rounded-full border border-[#d6e2d6] bg-white px-4 py-1.5 text-xs font-medium text-[#2c4234] hover:bg-[#f2f7f2]"
							}
						>
							Phân tích & Gợi ý chuyến đi
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "market"}
							onClick={() => switchTab("market")}
							className={
								activeTab === "market"
									? "rounded-full bg-[#164027] px-4 py-1.5 text-xs font-semibold text-white"
									: "rounded-full border border-[#d6e2d6] bg-white px-4 py-1.5 text-xs font-medium text-[#2c4234] hover:bg-[#f2f7f2]"
							}
						>
							Nhu cầu thị trường
						</button>
					</div>
				</div>
			</div>

			{activeTab === "market" ? (
				<Suspense fallback={<PageSkeleton />}>
					<LazyDemandInsightsPage actor={actor} />
				</Suspense>
			) : (
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
								Không tải được dữ liệu phân tích kinh doanh lúc này.
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
			)}
		</div>
	);
}
