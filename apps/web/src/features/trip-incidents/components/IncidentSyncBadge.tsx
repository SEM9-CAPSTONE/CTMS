import { CheckCircle2, CloudOff, Loader2, XCircle } from "lucide-react";
import { incidentSyncLabels, incidentSyncStyles } from "../constants";
import { IncidentSyncState } from "../types";

const icons = {
	[IncidentSyncState.PENDING]: CloudOff,
	[IncidentSyncState.SYNCING]: Loader2,
	[IncidentSyncState.SYNCED]: CheckCircle2,
	[IncidentSyncState.FAILED]: XCircle,
};

export function IncidentSyncBadge({ state }: { state: IncidentSyncState }) {
	const Icon = icons[state];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${incidentSyncStyles[state]}`}
		>
			<Icon
				aria-hidden="true"
				className={`size-3.5 ${state === IncidentSyncState.SYNCING ? "animate-spin" : ""}`}
			/>
			<span>{incidentSyncLabels[state]}</span>
		</span>
	);
}
