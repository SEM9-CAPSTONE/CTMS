import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import { useHostOverview } from "../hooks/useHostOverview";
import { openOverviewDetail } from "../utils";
import { OverviewKpis } from "./OverviewKpis";
import { OverviewSections } from "./OverviewSections";
import { OverviewToolbar } from "./OverviewToolbar";

export function HostDashboardOverview({
	hostId,
	onNavigateToTripDetail,
}: { hostId: string; onNavigateToTripDetail?: (id: string) => void }) {
	const [page, setPage] = useState(1);
	const [accessDenied, setAccessDenied] = useState(false);
	const handleRestricted = useCallback(() => setAccessDenied(true), []);
	const client = useQueryClient();
	const query = useHostOverview(hostId, page, !accessDenied);
	const retry = () => {
		void client.invalidateQueries({ queryKey: queryKeys.hostOverview.forHost(hostId) });
	};
	if (accessDenied || query.restricted)
		return (
			<p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
				{text.restricted}
			</p>
		);
	if (query.isPending)
		return (
			<output
				aria-label={text.loading}
				className="block animate-pulse rounded-[28px] border border-[#dfe8df] bg-white p-8 text-[#627769]"
			>
				{text.loading}
			</output>
		);
	if (!query.data)
		return (
			<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
				<p>{text.error}</p>
				<Button onClick={retry} className="mt-3">
					{text.retry}
				</Button>
			</div>
		);
	const data = query.data;
	const totals = [data.activeTrips, data.sos, data.weather].map(
		(section) => section.data?.total ?? 0
	);
	const pages = Math.max(1, ...totals.map((total) => Math.ceil(total / data.limit)));
	const openTrip =
		onNavigateToTripDetail ?? ((id: string) => openOverviewDetail(RoutePath.TRIP_DETAIL, id));
	return (
		<div data-testid="host-dashboard-overview" className="space-y-4">
			{query.stale && (
				<output className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
					{text.stale}
				</output>
			)}
			<OverviewKpis overview={data} />
			<OverviewToolbar
				data={data}
				pages={pages}
				busy={query.isFetching}
				onPrevious={() => setPage((value) => value - 1)}
				onNext={() => setPage((value) => value + 1)}
				onRefresh={retry}
			/>
			<OverviewSections
				hostId={hostId}
				data={data}
				onTrip={openTrip}
				onRestricted={handleRestricted}
			/>
		</div>
	);
}
