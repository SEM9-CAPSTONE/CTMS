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
				<p className="text-sm font-semibold">{item.camperName || "Chưa cập nhật tên khách"}</p>
				{item.tripTitle && <p className="mt-1 text-xs text-[#65756a]">{item.tripTitle}</p>}
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
				{item.porterName || "Chưa cập nhật tên người dẫn đường"}
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
						{assignment.tripTitle ||
							tripNames.get(assignment.tripId) ||
							"Chưa cập nhật tên chuyến đi"}
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
