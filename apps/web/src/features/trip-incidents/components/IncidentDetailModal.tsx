import { Edit3, ExternalLink, ImageIcon, MapPin, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import {
	incidentCategoryLabels,
	incidentLocationNotes,
	incidentMediaLabels,
	incidentSeverityLabels,
	incidentSeverityStyles,
	incidentStatusLabels,
} from "../constants";
import { type IncidentListItem, type IncidentStatus, IncidentSyncState } from "../types";
import { resolveMediaUrl } from "../utils/media-url";
import { IncidentSyncBadge } from "./IncidentSyncBadge";

export interface IncidentDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	incident: IncidentListItem | null;
	canManage?: boolean;
	onOpenResolution?: (incident: IncidentListItem) => void;
}

const STATUS_TONES: Record<IncidentStatus, StatusBadgeTone> = {
	open: "warning",
	investigating: "info",
	resolved: "success",
	closed: "neutral",
};

export function IncidentDetailModal({
	isOpen,
	onClose,
	incident,
	canManage = false,
	onOpenResolution,
}: IncidentDetailModalProps): ReactNode {
	if (!incident) return null;

	const isSynced = incident.syncState === IncidentSyncState.SYNCED;
	const mediaLabel = incidentMediaLabels[incident.mediaState];

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Chi tiết sự cố" size="lg">
			<div className="space-y-4 p-5 text-sm text-[#10221b]">
				{/* Top Badges */}
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf3ed] pb-3">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-extrabold text-[#10221b]">
							{incidentCategoryLabels[incident.category]}
						</span>
						<span
							className={`rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[incident.severity]}`}
						>
							{incidentSeverityLabels[incident.severity]}
						</span>
						{incident.status && (
							<StatusBadge tone={STATUS_TONES[incident.status]}>
								{incidentStatusLabels[incident.status]}
							</StatusBadge>
						)}
						<IncidentSyncBadge state={incident.syncState} />
					</div>
					<span className="text-xs text-[#667a6d]">
						{new Date(incident.occurredAt).toLocaleString("vi-VN")}
					</span>
				</div>

				{/* Description */}
				<div>
					<h3 className="text-xs font-bold uppercase tracking-wider text-[#7b8c82]">Mô tả sự cố</h3>
					<p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[#f8faf7] p-3 text-sm text-[#33463a]">
						{incident.description}
					</p>
				</div>

				{/* Reporter & Location info */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="rounded-xl border border-[#dfe8df] p-3">
						<span className="block text-xs font-bold text-[#7b8c82]">Người báo cáo</span>
						<p className="mt-1 font-semibold text-[#10221b]">
							{incident.reporterName || "Người dùng ẩn danh"}
						</p>
					</div>

					<div className="rounded-xl border border-[#dfe8df] p-3">
						<span className="flex items-center gap-1 text-xs font-bold text-[#7b8c82]">
							<MapPin className="size-3.5" />
							Toạ độ GPS
						</span>
						{incident.location ? (
							<p className="mt-1 text-xs text-[#33463a]">
								<span className="font-semibold">
									{incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}
								</span>{" "}
								(±{Math.round(incident.location.accuracyMeters)}m)
								{incident.locationStatus && incidentLocationNotes[incident.locationStatus] && (
									<span className="text-[#667a6d]">
										{" "}
										· {incidentLocationNotes[incident.locationStatus]}
									</span>
								)}
							</p>
						) : (
							<p className="mt-1 text-xs italic text-slate-500">Không có dữ liệu GPS.</p>
						)}
					</div>
				</div>

				{/* Media Info */}
				{mediaLabel && (
					<div className="rounded-xl border border-[#dfe8df] p-3">
						<span className="flex items-center gap-1 text-xs font-bold text-[#7b8c82]">
							<ImageIcon className="size-3.5" />
							Hình ảnh đính kèm
						</span>
						<div className="mt-2">
							{incident.mediaUrl ? (
								<div className="space-y-2">
									<div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
										<img
											src={resolveMediaUrl(incident.mediaUrl) ?? incident.mediaUrl}
											alt="Hình ảnh sự cố"
											className="max-h-60 w-full object-contain"
										/>
									</div>
									<a
										href={resolveMediaUrl(incident.mediaUrl) ?? incident.mediaUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 text-xs font-bold text-[#164027] underline hover:text-[#0f2e1c]"
									>
										<span>Xem ảnh gốc</span>
										<ExternalLink className="size-3" />
									</a>
								</div>
							) : (
								<span className="text-xs text-slate-500">{mediaLabel}</span>
							)}
						</div>
					</div>
				)}

				{/* Sync Error Alert */}
				{incident.lastError && (
					<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
						{incident.lastError}
					</div>
				)}

				{/* Action Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-[#edf3ed] pt-4">
					<Button variant="outline" size="sm" onClick={onClose}>
						<X className="mr-1 size-3.5" />
						<span>Đóng</span>
					</Button>
					{canManage && isSynced && onOpenResolution && (
						<Button
							size="sm"
							onClick={() => {
								onClose();
								onOpenResolution(incident);
							}}
						>
							<Edit3 className="mr-1 size-3.5" />
							<span>Xử lý sự cố</span>
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
}
