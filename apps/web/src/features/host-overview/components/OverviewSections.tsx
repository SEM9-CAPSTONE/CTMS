import { ArrowUpRight, Mountain } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import { useOverviewRouteNames } from "../hooks/useOverviewRouteNames";
import type { HostOverview } from "../types";
import { overviewDate, overviewStatus } from "../utils";
import { OverviewInventory } from "./OverviewInventory";
import { OverviewSection } from "./OverviewSection";
import { OverviewWeather } from "./OverviewWeather";

export function OverviewSections({
	hostId,
	data,
	onTrip,
	onRestricted,
}: { hostId: string; data: HostOverview; onTrip: (id: string) => void; onRestricted: () => void }) {
	const zone = data.timeZone;
	const ownedRoutes = useOverviewRouteNames(hostId, data);
	return (
		<div className="grid items-stretch gap-4 lg:grid-cols-2">
			<OverviewSection title={text.trips} section={data.activeTrips} timeZone={zone}>
				{(item) => (
					<div className="flex items-start gap-3">
						<div className="mt-1 hidden rounded-xl bg-[#edf5ed] p-3 text-[#32704c] sm:block">
							<Mountain aria-hidden="true" className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<span className="inline-flex rounded-full bg-[#edf5ed] px-2 py-1 text-[10px] font-semibold text-[#32704c]">
								{overviewStatus(item.status)}
							</span>
							<p className="mt-2 text-base font-semibold leading-6 text-[#183a28]">{item.title}</p>
							<p className="mt-2 text-xs leading-5 text-[#718076]">
								{overviewDate(item.startsAt, zone)} – {overviewDate(item.endsAt, zone)}
							</p>
							<Button
								size="sm"
								variant="outline"
								className="mt-3 gap-2"
								onClick={() => onTrip(item.id)}
							>
								{text.tripDetail}
								<ArrowUpRight aria-hidden="true" className="size-3.5" />
							</Button>
						</div>
					</div>
				)}
			</OverviewSection>
			<OverviewSection
				title={text.sos}
				section={data.sos}
				timeZone={zone}
				emptyMessage="Không có SOS đang chờ xử lý."
			>
				{(item) => (
					<div className="border-l-2 border-red-400 pl-3">
						<p className="text-sm font-semibold text-red-800">
							SOS · {overviewStatus(item.emergencyType)}
						</p>
						<p className="mt-1 text-xs text-[#65756a]">
							{item.status === "active" ? "Chờ tiếp nhận" : overviewStatus(item.status)} ·{" "}
							{overviewDate(item.eventTime, zone)}
						</p>
						<Button size="sm" variant="ghost" className="mt-1" onClick={() => onTrip(item.tripId)}>
							{text.tripDetail}
						</Button>
					</div>
				)}
			</OverviewSection>
			<OverviewInventory hostId={hostId} data={data} onTrip={onTrip} onRestricted={onRestricted} />
			<OverviewSection
				title={text.weather}
				section={data.weather}
				timeZone={zone}
				className="lg:min-h-[500px]"
				listClassName="grid flex-1 content-between gap-3"
			>
				{(item) => (
					<OverviewWeather
						weather={item}
						timeZone={zone}
						routeName={ownedRoutes.get(item.routeId)}
						canViewRoute={ownedRoutes.has(item.routeId)}
					/>
				)}
			</OverviewSection>
		</div>
	);
}
