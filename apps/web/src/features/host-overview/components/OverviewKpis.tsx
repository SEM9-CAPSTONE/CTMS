import { OVERVIEW_TEXT } from "../constants";
import type { HostOverview } from "../types";

export function OverviewKpis({ overview }: { overview: HostOverview }) {
	const items = [
		[
			OVERVIEW_TEXT.bookings,
			overview.kpis.todaysBookings,
			`${OVERVIEW_TEXT.bookingBasis}: ${overview.bookingDate}`,
		],
		[OVERVIEW_TEXT.trips, overview.kpis.activeTrips, null],
		[OVERVIEW_TEXT.routes, overview.kpis.routes, null],
		[OVERVIEW_TEXT.porters, overview.kpis.assignedPorters, OVERVIEW_TEXT.porterBasis],
		[OVERVIEW_TEXT.sos, overview.kpis.unresolvedSos, null],
	] as const;
	return (
		<section aria-label="Chỉ số vận hành" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
			{items.map(([label, value, helper]) => (
				<div key={label} className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
					<p className="text-xs font-bold uppercase tracking-wide text-[#627769]">{label}</p>
					<p className="mt-3 text-3xl font-extrabold text-[#10221b]">
						{value === null ? "—" : value.toLocaleString("vi-VN")}
					</p>
					{value === null ? (
						<p className="mt-2 text-xs text-amber-800">{OVERVIEW_TEXT.noMetrics}</p>
					) : (
						helper && <p className="mt-2 text-xs text-[#627769]">{helper}</p>
					)}
				</div>
			))}
		</section>
	);
}
