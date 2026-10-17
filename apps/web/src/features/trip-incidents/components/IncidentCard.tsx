import { ImageIcon, MapPin } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import {
	incidentCategoryLabels,
	incidentLocationNotes,
	incidentMediaLabels,
	incidentSeverityLabels,
	incidentSeverityStyles,
} from "../constants";
import { type IncidentListItem, IncidentMediaState, IncidentSyncState } from "../types";
import { IncidentSyncBadge } from "./IncidentSyncBadge";

export interface IncidentCardProps {
	item: IncidentListItem;
	onRetry: (id: string) => void;
	onDiscard: (id: string) => void;
	onDropPhoto: (id: string) => void;
}

function locationText(item: IncidentListItem): string {
	if (!item.location) return "Không có vị trí";
	const { latitude, longitude, accuracyMeters } = item.location;
	const note = item.locationStatus ? incidentLocationNotes[item.locationStatus] : null;
	const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracyMeters)} m)`;
	return note ? `${coordinates} · ${note}` : coordinates;
}

export function IncidentCard({ item, onRetry, onDiscard, onDropPhoto }: IncidentCardProps) {
	const isFailed = item.syncState === IncidentSyncState.FAILED;
	const isMediaFailed = item.mediaState === IncidentMediaState.FAILED;
	const mediaLabel = incidentMediaLabels[item.mediaState];
	return (
		<li className="space-y-2 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-extrabold text-[#10221b]">
					{incidentCategoryLabels[item.category]}
				</span>
				<span
					className={`rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[item.severity]}`}
				>
					{incidentSeverityLabels[item.severity]}
				</span>
				<IncidentSyncBadge state={item.syncState} />
			</div>
			<p className="text-sm text-[#33463a]">{item.description}</p>
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667a6d]">
				<span>{new Date(item.occurredAt).toLocaleString("vi-VN")}</span>
				<span className="flex items-center gap-1">
					<MapPin aria-hidden="true" className="size-3.5" />
					<span>{locationText(item)}</span>
				</span>
				{mediaLabel && (
					<span className="flex items-center gap-1">
						<ImageIcon aria-hidden="true" className="size-3.5" />
						{item.mediaUrl ? (
							<a href={item.mediaUrl} target="_blank" rel="noreferrer" className="underline">
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
