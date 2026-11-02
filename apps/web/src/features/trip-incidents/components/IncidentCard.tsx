import { Edit3, ImageIcon, MapPin, User } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import {
	incidentCategoryLabels,
	incidentLocationNotes,
	incidentMediaLabels,
	incidentSeverityLabels,
	incidentSeverityStyles,
	incidentStatusLabels,
} from "../constants";
import {
	type IncidentListItem,
	IncidentMediaState,
	type IncidentStatus,
	IncidentSyncState,
} from "../types";
import { resolveMediaUrl } from "../utils/media-url";
import { IncidentSyncBadge } from "./IncidentSyncBadge";

const STATUS_TONES: Record<IncidentStatus, StatusBadgeTone> = {
	open: "warning",
	investigating: "info",
	resolved: "success",
	closed: "neutral",
};

export interface IncidentCardProps {
	item: IncidentListItem;
	onRetry: (id: string) => void;
	onDiscard: (id: string) => void;
	onDropPhoto: (id: string) => void;
	onManage?: (item: IncidentListItem) => void;
}

function locationText(item: IncidentListItem): string {
	if (!item.location) return "Không có vị trí";
	const { latitude, longitude, accuracyMeters } = item.location;
	const note = item.locationStatus ? incidentLocationNotes[item.locationStatus] : null;
	const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracyMeters)} m)`;
	return note ? `${coordinates} · ${note}` : coordinates;
}

export function IncidentCard({
	item,
	onRetry,
	onDiscard,
	onDropPhoto,
	onManage,
}: IncidentCardProps) {
	const isFailed = item.syncState === IncidentSyncState.FAILED;
	const isMediaFailed = item.mediaState === IncidentMediaState.FAILED;
	const mediaLabel = incidentMediaLabels[item.mediaState];
	const isSynced = item.syncState === IncidentSyncState.SYNCED;

	return (
		<li className="space-y-2 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-extrabold text-[#10221b]">
						{incidentCategoryLabels[item.category]}
					</span>
					<span
						className={`rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[item.severity]}`}
					>
						{incidentSeverityLabels[item.severity]}
					</span>
					{item.status && (
						<StatusBadge tone={STATUS_TONES[item.status]}>
							{incidentStatusLabels[item.status]}
						</StatusBadge>
					)}
					<IncidentSyncBadge state={item.syncState} />
				</div>

				{onManage && isSynced && (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onManage(item)}
						className="text-xs h-7 px-2.5 font-bold"
					>
						<Edit3 className="size-3 mr-1" />
						<span>Xử lý sự cố</span>
					</Button>
				)}
			</div>

			<p className="text-sm text-[#33463a]">{item.description}</p>

			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667a6d]">
				<span>{new Date(item.occurredAt).toLocaleString("vi-VN")}</span>
				{item.assignedToName && (
					<span className="flex items-center gap-1 font-semibold text-emerald-800">
						<User className="size-3.5 text-emerald-700" />
						<span>Phụ trách: {item.assignedToName}</span>
					</span>
				)}
				<span className="flex items-center gap-1">
					<MapPin aria-hidden="true" className="size-3.5" />
					<span>{locationText(item)}</span>
				</span>
				{mediaLabel && (
					<span className="flex items-center gap-1">
						<ImageIcon aria-hidden="true" className="size-3.5" />
						{item.mediaUrl ? (
							<a
								href={resolveMediaUrl(item.mediaUrl) ?? item.mediaUrl}
								target="_blank"
								rel="noreferrer"
								className="underline"
							>
								{mediaLabel}
							</a>
						) : (
							<span>{mediaLabel}</span>
						)}
					</span>
				)}
			</div>

			{item.lastError && (
				<p
					role={isFailed || isMediaFailed ? "alert" : undefined}
					className="text-xs font-semibold text-rose-800"
				>
					{item.lastError}
				</p>
			)}

			{(isFailed || isMediaFailed) && (
				<div className="flex flex-wrap gap-2">
					<Button size="sm" variant="outline" onClick={() => onRetry(item.id)}>
						Thử lại
					</Button>
					{isFailed && (
						<Button size="sm" variant="ghost" onClick={() => onDiscard(item.id)}>
							Xóa khỏi thiết bị
						</Button>
					)}
					{isMediaFailed && (
						<Button size="sm" variant="ghost" onClick={() => onDropPhoto(item.id)}>
							Bỏ ảnh
						</Button>
					)}
				</div>
			)}
		</li>
	);
}
