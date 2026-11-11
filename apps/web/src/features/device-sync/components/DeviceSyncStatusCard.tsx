import { AlertTriangle, Clock, Layers, MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { cn } from "../../../shared/utils/cn";
import { useDeviceSyncStatus } from "../hooks/useDeviceSyncStatus";
import type { GpsQueueStore } from "../storage/gps-queue.store";
import { DeviceSyncStatusBadge } from "./DeviceSyncStatusBadge";

export interface DeviceSyncStatusCardProps {
	tripId: string;
	userId?: string;
	gpsStore?: GpsQueueStore;
	className?: string;
}

export function DeviceSyncStatusCard({
	tripId,
	userId,
	gpsStore,
	className,
}: DeviceSyncStatusCardProps) {
	const { summary, isRetrying, isServerLoading, retry } = useDeviceSyncStatus(tripId, userId, {
		gpsStore,
	});

	const hasFailedOrPending =
		summary.pendingGpsCount > 0 ||
		summary.failedGpsCount > 0 ||
		summary.pendingSafetyCount > 0 ||
		summary.failedSafetyCount > 0;

	const formatLastSync = (timestamp: string | null) => {
		if (!timestamp) return "Chưa có bản ghi đồng bộ";
		try {
			const date = new Date(timestamp);
			return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN")}`;
		} catch {
			return timestamp;
		}
	};

	return (
		<div
			className={cn("rounded-xl border border-zinc-200 bg-white p-5 shadow-xs", className)}
			data-testid="device-sync-card"
		>
			<div className="flex items-center justify-between pb-4 border-b border-zinc-100">
				<div>
					<h3 className="text-base font-bold text-zinc-900">Đồng bộ thiết bị</h3>
				</div>
				<DeviceSyncStatusBadge state={summary.syncState} />
			</div>

			{/* Error Banner when errors are present (PB AC-4) */}
			{summary.lastError && (
				<div
					className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800"
					role="alert"
					data-testid="sync-error-banner"
				>
					<AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
					<div className="flex-1">
						<span className="font-semibold">Lỗi đồng bộ: </span>
						<span>{summary.lastError}</span>
					</div>
				</div>
			)}

			{/* Metrics Grid distinguishing Local Pending vs Server Confirmed (PB AC-1, AC-2, AC-6, BR-226) */}
			<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
				{/* GPS Logs Metric */}
				<div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
					<div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
						<MapPin className="size-3.5 text-zinc-400" />
						<span>Bản ghi GPS (Breadcrumbs)</span>
					</div>
					<div className="mt-2 flex items-baseline justify-between">
						<div>
							<div className="text-xl font-bold text-zinc-900">{summary.pendingGpsCount}</div>
							<div className="text-[11px] text-amber-700 font-medium">Chờ đồng bộ tại thiết bị</div>
						</div>
						<div className="text-right">
							<div className="text-sm font-semibold text-zinc-700">
								{summary.serverConfirmedGpsCount}
							</div>
							<div className="text-[11px] text-emerald-700 font-medium">Máy chủ đã nhận</div>
						</div>
					</div>
				</div>

				{/* Safety Events Metric */}
				<div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
					<div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
						<ShieldAlert className="size-3.5 text-zinc-400" />
						<span>Sự cố an toàn</span>
					</div>
					<div className="mt-2 flex items-baseline justify-between">
						<div>
							<div className="text-xl font-bold text-zinc-900">{summary.pendingSafetyCount}</div>
							<div className="text-[11px] text-amber-700 font-medium">Chờ đồng bộ tại thiết bị</div>
						</div>
						<div className="text-right">
							<div className="text-sm font-semibold text-zinc-700">
								{summary.serverConfirmedSafetyCount}
							</div>
							<div className="text-[11px] text-emerald-700 font-medium">Máy chủ đã nhận</div>
						</div>
					</div>
				</div>
			</div>

			{/* Sync Metadata (PB AC-3) */}
			<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
				<div className="flex items-center gap-1.5">
					<Clock className="size-3.5 text-zinc-400" />
					<span>Lần đồng bộ gần nhất:</span>
					<span className="font-medium text-zinc-800">{formatLastSync(summary.lastSyncAt)}</span>
				</div>

				<div className="flex items-center gap-1.5">
					<Layers className="size-3.5 text-zinc-400" />
					<span>Gói / Cấu hình:</span>
					<span className="font-mono text-zinc-800">
						{summary.packageVersion ? `${summary.packageVersion} · ` : ""}
						{summary.configVersion}
					</span>
				</div>
			</div>

			{/* Retry Action Bar (PB AC-5) */}
			<div className="mt-4 flex items-center justify-end border-t border-zinc-100 pt-3">
				<Button
					variant="outline"
					size="sm"
					onClick={() => void retry()}
					disabled={isRetrying || isServerLoading || !hasFailedOrPending}
					className="gap-2 cursor-pointer"
					data-testid="retry-sync-button"
				>
					<RefreshCw className={cn("size-3.5", isRetrying && "animate-spin")} />
					<span>{isRetrying ? "Đang đồng bộ..." : "Đồng bộ lại"}</span>
				</Button>
			</div>
		</div>
	);
}
