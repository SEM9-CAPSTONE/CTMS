import { CheckCircle2, CloudOff, Loader2, RefreshCw, XCircle } from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { SYNC_STATE_LABELS } from "../constants";
import { DeviceSyncState } from "../types";

export interface DeviceSyncStatusBadgeProps {
	state: DeviceSyncState;
	className?: string;
	showLabel?: boolean;
}

export function DeviceSyncStatusBadge({
	state,
	className,
	showLabel = true,
}: DeviceSyncStatusBadgeProps) {
	const label = SYNC_STATE_LABELS[state] ?? state;

	switch (state) {
		case DeviceSyncState.SYNCED:
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200",
						className
					)}
				>
					<CheckCircle2 className="size-3.5 text-emerald-600" />
					{showLabel && <span>{label}</span>}
				</span>
			);

		case DeviceSyncState.SYNCING:
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 animate-pulse",
						className
					)}
				>
					<Loader2 className="size-3.5 text-blue-600 animate-spin" />
					{showLabel && <span>{label}</span>}
				</span>
			);

		case DeviceSyncState.PENDING:
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200",
						className
					)}
				>
					<CloudOff className="size-3.5 text-amber-600" />
					{showLabel && <span>{label}</span>}
				</span>
			);

		case DeviceSyncState.FAILED:
		case DeviceSyncState.PARTIAL_FAILURE:
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200",
						className
					)}
				>
					<XCircle className="size-3.5 text-rose-600" />
					{showLabel && <span>{label}</span>}
				</span>
			);

		default:
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 border border-zinc-200",
						className
					)}
				>
					<RefreshCw className="size-3.5 text-zinc-500" />
					{showLabel && <span>{label}</span>}
				</span>
			);
	}
}
