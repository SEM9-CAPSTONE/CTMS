import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import type { HostOverview } from "../types";
import { overviewDate, overviewStatus } from "../utils";
import { OverviewActiveTrips } from "./OverviewActiveTrips";
import { OverviewInventory } from "./OverviewInventory";
import { OverviewSection } from "./OverviewSection";

export function OverviewSections({
	hostId,
	data,
	onTrip,
	onRestricted,
}: { hostId: string; data: HostOverview; onTrip: (id: string) => void; onRestricted: () => void }) {
	const zone = data.timeZone;
	return (
		<div className="grid items-stretch gap-4 lg:grid-cols-2">
			<OverviewActiveTrips hostId={hostId} onTrip={onTrip} onRestricted={onRestricted} />
			<OverviewSection
				title={text.sos}
				section={data.sos}
				timeZone={zone}
				emptyMessage="Hiện không có yêu cầu cứu trợ cần xử lý."
			>
				{(item) => (
					<div className="border-l-2 border-red-400 pl-3">
						<p className="text-sm font-semibold text-red-800">
							SOS · {overviewStatus(item.emergencyType)}
						</p>
						<p className="mt-1 text-xs text-[#65756a]">
							{item.status === "active"
								? "Chờ tiếp nhận"
								: item.status === "acknowledged"
									? "Đã tiếp nhận · Đang hỗ trợ"
									: overviewStatus(item.status)}{" "}
							· {overviewDate(item.eventTime, zone)}
						</p>
						<Button size="sm" variant="ghost" className="mt-1" onClick={() => onTrip(item.tripId)}>
							{text.tripDetail}
						</Button>
					</div>
				)}
			</OverviewSection>
			<OverviewInventory hostId={hostId} data={data} onTrip={onTrip} onRestricted={onRestricted} />
		</div>
	);
}
