import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import type { HostOverview, OverviewInventoryTab } from "../types";
import { OverviewBookingRow, OverviewPorterRow, OverviewRouteRow } from "./OverviewInventoryRows";
import { OverviewSection } from "./OverviewSection";

export function OverviewInventoryPanel({
	active,
	data,
	loading,
	restricted,
	stale,
	onRetry,
	onTrip,
}: {
	active: OverviewInventoryTab;
	data?: HostOverview;
	loading: boolean;
	restricted: boolean;
	stale: boolean;
	onRetry: () => void;
	onTrip: (id: string) => void;
}) {
	if (restricted)
		return (
			<p role="alert" className="py-5 text-sm text-amber-800">
				{text.restricted}
			</p>
		);
	if (loading)
		return (
			<output className="flex h-full items-center justify-center py-5 text-sm text-[#829087]">
				Đang tải danh sách…
			</output>
		);
	if (!data)
		return (
			<div role="alert" className="py-5 text-sm text-[#829087]">
				<p>Không tải được trang danh sách.</p>
				<Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
					{text.retry}
				</Button>
			</div>
		);
	const tripNames = new Map(data.activeTrips.data?.items.map((trip) => [trip.id, trip.title]));
	return (
		<div className="flex h-full flex-col">
			{stale && (
				<output className="mb-3 text-xs text-amber-800">
					Dữ liệu danh sách đang cũ. {text.refresh} để cập nhật.
				</output>
			)}
			{active === "bookings" && (
				<OverviewSection
					title={text.bookings}
					section={data.bookings}
					timeZone={data.timeZone}
					showHeading={false}
					surface="plain"
					className="flex-1"
				>
					{(item) => <OverviewBookingRow item={item} zone={data.timeZone} onTrip={onTrip} />}
				</OverviewSection>
			)}
			{active === "porters" && (
				<OverviewSection
					title={text.porters}
					section={data.porters}
					timeZone={data.timeZone}
					showHeading={false}
					surface="plain"
					className="flex-1"
				>
					{(item) => <OverviewPorterRow item={item} tripNames={tripNames} onTrip={onTrip} />}
				</OverviewSection>
			)}
			{active === "routes" && (
				<OverviewSection
					title={text.routes}
					section={data.routes}
					timeZone={data.timeZone}
					showHeading={false}
					surface="plain"
					className="flex-1"
				>
					{(item) => <OverviewRouteRow item={item} />}
				</OverviewSection>
			)}
		</div>
	);
}
