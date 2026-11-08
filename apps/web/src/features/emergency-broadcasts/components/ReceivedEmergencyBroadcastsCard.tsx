import { Megaphone } from "lucide-react";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { emergencyAlertTypeLabel, formatBroadcastTime } from "../constants";
import { useEmergencyBroadcasts } from "../hooks/useEmergencyBroadcasts";
import type { EmergencyBroadcastsService } from "../services/emergency-broadcasts.service";

export interface ReceivedEmergencyBroadcastsCardProps {
	tripId: string;
	enabled?: boolean;
	service?: EmergencyBroadcastsService;
	connection?: RealtimeConnection;
}

/**
 * CTMS-081-T02: emergency alerts that addressed this Camper/Porter for the Trip, recovered from the
 * API so alerts missed while offline are still seen. Renders nothing until there is one to show.
 */
export function ReceivedEmergencyBroadcastsCard({
	tripId,
	enabled = true,
	service,
	connection,
}: ReceivedEmergencyBroadcastsCardProps) {
	const query = useEmergencyBroadcasts(tripId, { enabled, service, connection });
	const broadcasts = query.data ?? [];
	if (!enabled || broadcasts.length === 0) return null;
	const [latest, ...older] = broadcasts;

	return (
		<section
			aria-label="Cảnh báo khẩn từ Host"
			data-testid="received-emergency-broadcasts"
			className="space-y-3 rounded-3xl border border-red-200 bg-red-50/60 p-5 shadow-sm"
		>
			<div className="flex items-center gap-3">
				<div className="rounded-2xl bg-red-100 p-2.5 text-red-600">
					<Megaphone aria-hidden="true" className="size-5" />
				</div>
				<div>
					<h3 className="font-extrabold text-red-950">Cảnh báo khẩn từ Host</h3>
					<p className="text-xs text-red-800">Làm theo hướng dẫn mới nhất của Host.</p>
				</div>
			</div>
			<article
				data-testid="received-emergency-broadcast-latest"
				className="space-y-1.5 rounded-2xl border border-red-200 bg-white p-4"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<StatusBadge tone="danger">{emergencyAlertTypeLabel(latest.alertType)}</StatusBadge>
					<span className="text-[11px] text-[#7b8c82]">
						{formatBroadcastTime(latest.createdAt)}
					</span>
				</div>
				<p className="whitespace-pre-line text-sm font-medium text-[#10221b]">{latest.content}</p>
			</article>
			{older.length > 0 && (
				<ul className="space-y-2">
					{older.map((broadcast) => (
						<li
							key={broadcast.id}
							data-testid="received-emergency-broadcast-item"
							className="rounded-2xl border border-[#f1d5d5] bg-white/80 p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-xs font-bold text-red-800">
									{emergencyAlertTypeLabel(broadcast.alertType)}
								</span>
								<span className="text-[11px] text-[#7b8c82]">
									{formatBroadcastTime(broadcast.createdAt)}
								</span>
							</div>
							<p className="mt-1 whitespace-pre-line text-xs text-[#425048]">{broadcast.content}</p>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
