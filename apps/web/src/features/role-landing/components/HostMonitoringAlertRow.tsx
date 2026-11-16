import { Clock3, MapPin } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import type { ParticipantSelection } from "../types/active-trip-map";
import type { TripAlert } from "../types/trip-alert";
import {
	formatTime,
	freshnessLabels,
	locationFreshness,
	participantLabel,
	participantRoleLabel,
	relativePositionTime,
} from "../utils/participant-position";
import { alertSeverityLabels, alertTypeLabels } from "../utils/trip-alert";

interface Props {
	alert: TripAlert;
	code?: string;
	selection?: ParticipantSelection;
	maxAgeSeconds: number;
	now: number;
	onSelect: (alert: TripAlert) => void;
}

export function HostMonitoringAlertRow({
	alert,
	code,
	selection,
	maxAgeSeconds,
	now,
	onSelect,
}: Props) {
	const selected =
		selection?.participantId === alert.participantId && selection.role === alert.role;
	const freshness = locationFreshness(
		alert.lastLocationAt,
		Boolean(alert.location),
		maxAgeSeconds,
		now
	);
	const Icon = alert.alertType === "OFF_ROUTE" ? MapPin : Clock3;
	return (
		<Button
			key={`${alert.role}:${alert.participantId}:${alert.alertType}`}
			variant="ghost"
			aria-pressed={selected}
			onClick={() => onSelect(alert)}
			title={`Ghi nhận: ${formatTime.format(new Date(alert.observedAt))}`}
			className={`h-auto w-full justify-start whitespace-normal rounded-lg border px-3 py-2 text-left ${selected ? "border-emerald-800 bg-emerald-50" : "border-slate-200"}`}
		>
			<div className="min-w-0 space-y-1">
				<p className="font-semibold leading-snug">
					{code ? `${code} · ` : ""}
					{participantLabel(alert)}{" "}
					<span className="font-normal text-slate-600">· {participantRoleLabel(alert.role)}</span>
				</p>
				<p className={alert.severity === "SEVERELY_BEHIND" ? "text-red-800" : "text-amber-900"}>
					<Icon className="mr-1 inline size-4" aria-hidden="true" />
					{alert.severity ? alertSeverityLabels[alert.severity] : alertTypeLabels[alert.alertType]}
				</p>
				<p className="text-xs leading-relaxed text-slate-700">
					{freshnessLabels[freshness]}
					{alert.lastLocationAt ? ` · ${relativePositionTime(alert.lastLocationAt, now)}` : ""}
					<span className="mx-1" aria-hidden="true">
						·
					</span>
					Ghi nhận: {formatTime.format(new Date(alert.observedAt))}
				</p>
			</div>
		</Button>
	);
}
