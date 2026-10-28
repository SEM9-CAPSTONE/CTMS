import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import type { HostOverview } from "../types";
import { openOverviewDetail, overviewDate, overviewStatus } from "../utils";
import { OverviewSection } from "./OverviewSection";
import { OverviewWeather } from "./OverviewWeather";

export function OverviewSections({
	data,
	onTrip,
}: { data: HostOverview; onTrip: (id: string) => void }) {
	const zone = data.timeZone;
	const tripNames = new Map(data.activeTrips.data?.items.map((trip) => [trip.id, trip.title]));
	const ownedRoutes = new Map(data.routes.data?.items.map((route) => [route.id, route.name]));
	return (
		<div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
			<OverviewSection title={text.sos} section={data.sos} timeZone={zone}>
				{(item) => (
					<>
						<div className="rounded-xl border border-red-200 bg-red-50 p-3">
							<p className="font-bold text-red-900">SOS · {overviewStatus(item.emergencyType)}</p>
							<p className="mt-1 text-sm text-red-900">
								{item.status === "active" ? "Chờ tiếp nhận" : overviewStatus(item.status)}
							</p>
							<p className="mt-2 text-xs">
								{text.event}: {overviewDate(item.eventTime, zone)}
							</p>
							<p className="mt-1 text-xs">Máy chủ nhận: {overviewDate(item.receivedAt, zone)}</p>
							<Button
								size="sm"
								variant="ghost"
								className="mt-2"
								onClick={() => onTrip(item.tripId)}
							>
								{text.tripDetail} · {tripNames.get(item.tripId) ?? `#${item.tripId.slice(0, 8)}`}
							</Button>
						</div>
					</>
				)}
			</OverviewSection>
			<OverviewSection title={text.weather} section={data.weather} timeZone={zone}>
				{(item) => (
					<OverviewWeather
						weather={item}
						timeZone={zone}
						routeName={ownedRoutes.get(item.routeId)}
						canViewRoute={ownedRoutes.has(item.routeId)}
					/>
				)}
			</OverviewSection>
			<OverviewSection title={text.trips} section={data.activeTrips} timeZone={zone}>
				{(item) => (
					<>
						<p className="font-bold">{item.title}</p>
						<p className="text-sm text-[#627769]">{overviewStatus(item.status)}</p>
						<p className="text-xs text-[#627769]">
							{overviewDate(item.startsAt, zone)} – {overviewDate(item.endsAt, zone)}
						</p>
						<Button size="sm" variant="ghost" onClick={() => onTrip(item.id)}>
							{text.tripDetail}
						</Button>
					</>
				)}
			</OverviewSection>
			<OverviewSection title={text.bookings} section={data.bookings} timeZone={zone}>
				{(item) => (
					<>
						<p className="font-bold">Booking #{item.id.slice(0, 8)}</p>
						<p className="text-sm">
							{overviewStatus(item.status)} · {overviewStatus(item.paymentStatus)}
						</p>
						<p className="text-xs text-[#627769]">
							{item.numPeople === null ? text.unknown : `${item.numPeople} người`} · {text.created}:{" "}
							{overviewDate(item.createdAt, zone)}
						</p>
						<Button size="sm" variant="ghost" onClick={() => onTrip(item.tripId)}>
							{text.tripDetail}
						</Button>
					</>
				)}
			</OverviewSection>
			<OverviewSection title={text.porters} section={data.porters} timeZone={zone}>
				{(item) => (
					<>
						<p className="font-bold">Porter #{item.porterId.slice(0, 8)}</p>
						{item.assignments.map((assignment) => (
							<div key={assignment.tripId} className="flex flex-wrap items-center gap-2 text-sm">
								<Button size="sm" variant="ghost" onClick={() => onTrip(assignment.tripId)}>
									{tripNames.get(assignment.tripId) ?? `Trip #${assignment.tripId.slice(0, 8)}`}
								</Button>
								<span>{overviewStatus(assignment.status)}</span>
							</div>
						))}
						<Button
							size="sm"
							variant="ghost"
							onClick={() => openOverviewDetail(RoutePath.HOST_PORTER)}
						>
							{text.porterDetail}
						</Button>
					</>
				)}
			</OverviewSection>
			<OverviewSection title={text.routes} section={data.routes} timeZone={zone}>
				{(item) => (
					<>
						<p className="font-bold">{item.name}</p>
						<p className="text-sm text-[#627769]">{overviewStatus(item.status)}</p>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => openOverviewDetail(RoutePath.HOST_TREKKING_ROUTE_DETAIL, item.id)}
						>
							{text.routeDetail}
						</Button>
					</>
				)}
			</OverviewSection>
		</div>
	);
}
