import { useState } from "react";
import { Button } from "../../../shared/components";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { useRouteDangerZoneProposals } from "../hooks/useDangerZoneProposals";
import { HostProposalModal } from "./HostProposalModal";
import { RouteProposalList } from "./RouteProposalList";

/** Host proposals on one Route, in any Route status; Admin review decides publication. */
export function RouteDangerZoneProposals({ route }: { route: CreatedTrekkingRoute }) {
	const proposals = useRouteDangerZoneProposals(route.id);
	const [open, setOpen] = useState(false);

	return (
		<section className="mt-6 space-y-3" aria-labelledby="route-proposals-title">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 id="route-proposals-title" className="text-lg font-semibold text-[#10221b]">
					Đề xuất điểm nguy hiểm
				</h3>
				<Button type="button" onClick={() => setOpen(true)}>
					Thêm đề xuất
				</Button>
			</div>
			{proposals.error && (
				<div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
					<span role="alert">{proposals.error}</span>
					<Button size="sm" variant="outline" onClick={() => void proposals.reload()}>
						Thử lại
					</Button>
				</div>
			)}
			{!proposals.loading && !proposals.error && <RouteProposalList rows={proposals.items} />}
			{open && (
				<HostProposalModal
					route={route}
					onClose={() => setOpen(false)}
					onCreated={() => void proposals.reload()}
				/>
			)}
		</section>
	);
}
