import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { RoutePath } from "../../../routes/routes.config";
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
			<div className="flex flex-col justify-between rounded-2xl border border-[#e0e7df] bg-white p-5 shadow-[0_2px_6px_#183a2805]">
				<OverviewSection
					id="host-rescue-requests"
					title={text.sos}
					section={data.sos}
					timeZone={zone}
					surface="plain"
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
								{item.status === "active" && (
									<Button size="sm" variant="primary" onClick={() => setSelectedSos(item)}>
										Tiếp nhận
									</Button>
								)}
								{item.status === "acknowledged" && (
									<>
										<Button
											size="sm"
											variant="outline"
											disabled
											className="cursor-not-allowed opacity-60 bg-[#f4f7f2] text-[#8fa096] border-[#dfe8df]"
										>
											Đã tiếp nhận
										</Button>
										<Button size="sm" variant="primary" onClick={() => setSelectedSos(item)}>
											Đóng SOS
										</Button>
									</>
								)}
								<Button size="sm" variant="ghost" onClick={() => onTrip(item.tripId)}>
									{text.tripDetail}
								</Button>
							</div>
						</div>
					)}
				</OverviewSection>
				<div className="mt-4 pt-3 border-t border-[#e7eee7] flex items-center justify-between">
					<span className="text-xs text-[#627769]">Quản lý toàn bộ cứu trợ</span>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							window.history.pushState({}, "", RoutePath.HOST_SOS);
							window.dispatchEvent(new PopStateEvent("popstate"));
						}}
						className="text-xs font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<span>Xem tất cả</span>
						<ArrowRight className="size-3.5 ml-1" />
					</Button>
				</div>
			</div>
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
