import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { Button } from "../../../shared/components/Button";
import { SosResolutionModal } from "../../sos-handling/components/SosResolutionModal";
import { OVERVIEW_TEXT as text } from "../constants";
import type { HostOverview, OverviewSos } from "../types";
import { overviewDate, overviewStatus } from "../utils";
import { OverviewActiveTrips } from "./OverviewActiveTrips";
import { OverviewSection } from "./OverviewSection";

export function OverviewSections({
	hostId,
	data,
	onTrip,
	onRestricted,
}: {
	hostId: string;
	data: HostOverview;
	onTrip: (id: string) => void;
	onRestricted: () => void;
}) {
	const zone = data.timeZone;
	const client = useQueryClient();
	const [selectedSos, setSelectedSos] = useState<OverviewSos | null>(null);

	return (
		<div className="grid items-stretch gap-4 lg:grid-cols-2">
			<div id="host-active-trips">
				<OverviewActiveTrips hostId={hostId} onTrip={onTrip} onRestricted={onRestricted} />
			</div>
			<OverviewSection
				id="host-rescue-requests"
				title={text.sos}
				section={data.sos}
				timeZone={zone}
				emptyMessage="Hiện không có yêu cầu cứu trợ cần xử lý."
			>
				{(item) => (
					<div className="border-l-2 border-red-400 pl-3">
						<p className="text-sm font-semibold text-red-800">
							Yêu cầu cứu trợ · {overviewStatus(item.emergencyType)}
						</p>
						<p className="mt-1 text-xs text-[#65756a]">
							{item.status === "active"
								? "Chờ tiếp nhận"
								: item.status === "acknowledged"
									? "Đã tiếp nhận · Đang hỗ trợ"
									: overviewStatus(item.status)}{" "}
							· {overviewDate(item.eventTime, zone)}
						</p>
						<div className="mt-2 flex items-center gap-2">
							{(item.status === "active" || item.status === "acknowledged") && (
								<Button
									size="sm"
									variant={item.status === "active" ? "default" : "outline"}
									onClick={() => setSelectedSos(item)}
								>
									{item.status === "active" ? "Tiếp nhận" : "Đóng SOS"}
								</Button>
							)}
							<Button size="sm" variant="ghost" onClick={() => onTrip(item.tripId)}>
								{text.tripDetail}
							</Button>
						</div>
					</div>
				)}
			</OverviewSection>
			<SosResolutionModal
				isOpen={selectedSos !== null}
				onClose={() => setSelectedSos(null)}
				sos={selectedSos}
				onUpdated={() => {
					void client.invalidateQueries({ queryKey: queryKeys.hostOverview.forHost(hostId) });
				}}
			/>
		</div>
	);
}
