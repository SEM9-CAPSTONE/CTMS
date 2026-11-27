import { Megaphone } from "lucide-react";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { HostEmergencyBroadcastCard } from "../../emergency-broadcasts/components/HostEmergencyBroadcastCard";
import type { useHostTripMonitoring } from "../hooks/useHostTripMonitoring";
import type { ParticipantSelection } from "../types/active-trip-map";
import { participantMapCode } from "../utils/participant-position";
import { HostMonitoringAlerts } from "./HostMonitoringAlerts";
import { HostMonitoringParticipants } from "./HostMonitoringParticipants";

interface Props {
	monitoring: ReturnType<typeof useHostTripMonitoring>;
	tripId: string;
	onSelect: (value?: ParticipantSelection) => void;
	onRefreshTrips: () => void;
}
export function HostMonitoringRoster({ monitoring, tripId, onSelect, onRefreshTrips }: Props) {
	const [tab, setTab] = useState<"members" | "alerts">("members");
	const [broadcastOpen, setBroadcastOpen] = useState(false);
	const id = useId();
	const { maps, trip, now, member, selected, selectAlert, alertNotice } = monitoring;
	if (!trip) return null;
	const codes = Object.fromEntries(
		trip.participants.map((participant, index) => [
			`${participant.role}:${participant.id}`,
			participantMapCode(participant.role, index),
		])
	);
	const members =
		trip.participants.length === 0 ? (
			<p>Chưa có thành viên trong chuyến đi.</p>
		) : (
			<HostMonitoringParticipants
				participants={trip.participants}
				member={member}
				tripId={tripId}
				now={now}
				onSelect={onSelect}
			/>
		);
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
				<div role="tablist" aria-label="Thông tin giám sát" className="flex gap-2">
					<Button
						role="tab"
						id={`${id}-members`}
						aria-controls={`${id}-panel`}
						aria-selected={tab === "members"}
						variant="outline"
						className="bg-white aria-selected:bg-[#164027] aria-selected:text-white"
						onClick={() => setTab("members")}
					>
						Thành viên
					</Button>
					<Button
						role="tab"
						id={`${id}-alerts`}
						aria-controls={`${id}-panel`}
						aria-selected={tab === "alerts"}
						title="Số cảnh báo được ghi nhận; một thành viên có thể có nhiều cảnh báo"
						variant="outline"
						className="bg-white aria-selected:bg-[#164027] aria-selected:text-white"
						onClick={() => setTab("alerts")}
					>
						Cảnh báo{maps.data?.alerts ? ` (${maps.data.alerts.alerts.length})` : ""}
					</Button>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={() => setBroadcastOpen(true)}
					className="inline-flex items-center gap-1.5 border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
				>
					<Megaphone className="size-3.5" aria-hidden="true" />
					<span>Phát cảnh báo</span>
				</Button>
			</div>
			{broadcastOpen &&
				createPortal(
					<Modal
						isOpen={broadcastOpen}
						onClose={() => setBroadcastOpen(false)}
						title="Phát cảnh báo khẩn"
						size="lg"
					>
						<HostEmergencyBroadcastCard tripId={tripId} />
					</Modal>,
					document.body
				)}
			{alertNotice && <output className="text-sm text-amber-900">{alertNotice}</output>}
			<div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
				{tab === "members" ? (
					members
				) : (
					<HostMonitoringAlerts
						alerts={maps.data?.alerts?.alerts ?? []}
						error={maps.data?.alertError}
						maxAgeSeconds={maps.data?.alerts?.freshnessMaxAgeSeconds ?? 0}
						now={now}
						selection={selected}
						onSelect={selectAlert}
						onRetry={() => void maps.refetch()}
						onRefreshTrips={onRefreshTrips}
						codes={codes}
					/>
				)}
			</div>
		</div>
	);
}
