import { useState } from "react";
import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import { useHostOverview } from "../hooks/useHostOverview";
import { openOverviewDetail, overviewDate } from "../utils";
import { OverviewKpis } from "./OverviewKpis";
import { OverviewSections } from "./OverviewSections";

export function HostDashboardOverview({
	hostId,
	onNavigateToTripDetail,
}: { hostId: string; onNavigateToTripDetail?: (id: string) => void }) {
	const [page, setPage] = useState(1);
	const query = useHostOverview(hostId, page);
	const retry = () => {
		void query.refetch();
	};
	if (query.restricted)
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
	const totals = [
		data.bookings,
		data.activeTrips,
		data.routes,
		data.porters,
		data.sos,
		data.weather,
	].map((section) => section.data?.total ?? 0);
	const pages = Math.max(1, ...totals.map((total) => Math.ceil(total / data.limit)));
	const openTrip =
		onNavigateToTripDetail ?? ((id: string) => openOverviewDetail(RoutePath.TRIP_DETAIL, id));
	return (
		<div data-testid="host-dashboard-overview" className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-xs text-[#627769]">
					Cập nhật: {overviewDate(data.generatedAt, data.timeZone)} · {data.timeZone}
				</p>
				<Button size="sm" variant="outline" onClick={retry} disabled={query.isFetching}>
					{query.isFetching ? text.refreshing : text.refresh}
				</Button>
			</div>
			{query.stale && (
				<output className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
					{text.stale}
				</output>
			)}
			<OverviewKpis overview={data} />
			<OverviewSections data={data} onTrip={openTrip} />
			<nav
				aria-label="Phân trang tổng quan"
				className="flex flex-wrap items-center justify-end gap-3 text-sm"
			>
				<Button
					size="sm"
					variant="outline"
					disabled={page <= 1 || query.isFetching}
					onClick={() => setPage((value) => value - 1)}
				>
					{text.previous}
				</Button>
				<span>
					Trang {data.page} / {Math.max(data.page, pages)}
				</span>
				<Button
					size="sm"
					variant="outline"
					disabled={page >= pages || query.isFetching}
					onClick={() => setPage((value) => value + 1)}
				>
					{text.next}
				</Button>
			</nav>
		</div>
	);
}
