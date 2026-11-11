import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import type { OverviewBooking, OverviewPorter, OverviewRoute } from "../types";
import { openOverviewDetail, overviewDate, overviewStatus } from "../utils";

export function OverviewBookingRow({
	item,
	zone,
	onTrip,
}: { item: OverviewBooking; zone: string; onTrip: (id: string) => void }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p className="text-sm font-semibold">Booking #{item.id.slice(0, 8)}</p>
				<p className="mt-1 text-xs text-[#65756a]">
					{overviewStatus(item.status)} · {overviewStatus(item.paymentStatus)}
				</p>
				<p className="mt-1 text-xs text-[#7b887f]">
					{item.numPeople === null ? text.unknown : `${item.numPeople} người`} ·{" "}
					{overviewDate(item.createdAt, zone)}
				</p>
			</div>
			<Button size="sm" variant="outline" onClick={() => onTrip(item.tripId)}>
				{text.tripDetail}
			</Button>
		</div>
	);
}
export function OverviewPorterRow({
	item,
	tripNames,
	onTrip,
}: { item: OverviewPorter; tripNames: Map<string, string>; onTrip: (id: string) => void }) {
	return (
		<>
			<p className="text-sm font-semibold">
				Porter <span className="font-normal text-[#79877d]">#{item.porterId.slice(0, 8)}</span>
			</p>
			{item.assignments.map((assignment) => (
				<div
					key={assignment.tripId}
					className="flex flex-wrap items-center justify-between gap-2 text-xs"
				>
					<button
						type="button"
						className="text-left font-medium text-[#23583b] hover:underline"
						onClick={() => onTrip(assignment.tripId)}
					>
						{tripNames.get(assignment.tripId) ?? `Trip #${assignment.tripId.slice(0, 8)}`}
					</button>
					<span className="text-[#65756a]">{overviewStatus(assignment.status)}</span>
				</div>
			))}
			<Button size="sm" variant="outline" onClick={() => openOverviewDetail(RoutePath.HOST_PORTER)}>
				{text.porterDetail}
			</Button>
		</>
	);
}
export function OverviewRouteRow({ item }: { item: OverviewRoute }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p className="text-sm font-semibold">{item.name}</p>
				<p className="mt-1 text-xs text-[#65756a]">{overviewStatus(item.status)}</p>
			</div>
			<Button
				size="sm"
				variant="outline"
				onClick={() => openOverviewDetail(RoutePath.HOST_TREKKING_ROUTE_DETAIL, item.id)}
			>
				{text.routeDetail}
			</Button>
		</div>
	);
}
