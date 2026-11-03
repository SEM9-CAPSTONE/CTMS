import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { Button } from "../../../shared/components/Button";
import { EmergencyAlertBanner } from "../../sos-handling/components/EmergencyAlertBanner";
import { OVERVIEW_TEXT as text } from "../constants";
import { useHostOverview } from "../hooks/useHostOverview";
import { OverviewKpis } from "./OverviewKpis";

export function HostDashboardOverview({
	hostId,
}: { hostId: string; onNavigateToTripDetail?: (id: string) => void }) {
	const client = useQueryClient();
	const query = useHostOverview(hostId, 1);
	const retry = () => {
		void client.invalidateQueries({ queryKey: queryKeys.hostOverview.forHost(hostId) });
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
	return (
		<div data-testid="host-dashboard-overview" className="space-y-4">
			<EmergencyAlertBanner
				alerts={data.sos.data?.items}
				onNavigateToSosCenter={() => {
					window.history.pushState({}, "", RoutePath.HOST_SOS);
					window.dispatchEvent(new PopStateEvent("popstate"));
				}}
				onUpdated={retry}
			/>
			<OverviewKpis overview={data} />
			{query.stale && <p className="text-right text-xs text-amber-800">Chưa cập nhật</p>}
		</div>
	);
}
