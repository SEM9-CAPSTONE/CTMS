import type { ReactNode } from "react";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import {
	incidentCategoryLabels,
	incidentLocationNotes,
	incidentSeverityLabels,
	incidentSeverityStyles,
	incidentStatusLabels,
} from "../constants";
import type { IncidentListItem, IncidentStatus } from "../types";

export interface IncidentOverviewSectionProps {
	incident: IncidentListItem;
}

const STATUS_TONES: Record<IncidentStatus, StatusBadgeTone> = {
	open: "warning",
	investigating: "info",
	resolved: "success",
	closed: "neutral",
};

export function IncidentOverviewSection({ incident }: IncidentOverviewSectionProps): ReactNode {
	return (
		<section className="rounded-xl border border-[#e2ece2] bg-[#f9fbf9] p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-extrabold text-[#10221b]">
						{incidentCategoryLabels[incident.category]}
					</span>
					<span
						className={`rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[incident.severity]}`}
					>
						{incidentSeverityLabels[incident.severity]}
					</span>
					<StatusBadge tone={STATUS_TONES[incident.status]}>
						{incidentStatusLabels[incident.status]}
					</StatusBadge>
				</div>
				<span className="text-xs text-[#667a6d]">
					Thời điểm: {new Date(incident.occurredAt).toLocaleString("vi-VN")}
				</span>
			</div>

			<p className="mt-2 text-sm text-[#33463a]">{incident.description}</p>

			<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667a6d]">
				{incident.reporterName && <span>Người báo cáo: {incident.reporterName}</span>}
				{incident.assignedToName ? (
					<span className="font-semibold text-emerald-800">
						Người xử lý: {incident.assignedToName}
					</span>
				) : (
					<span className="italic text-slate-500">Chưa có người xử lý</span>
				)}
				{incident.location && (
					<span>
						Tọa độ: {incident.location.latitude.toFixed(5)},{" "}
						{incident.location.longitude.toFixed(5)}
						{incident.locationStatus && incidentLocationNotes[incident.locationStatus] && (
							<> · {incidentLocationNotes[incident.locationStatus]}</>
						)}
					</span>
				)}
			</div>
		</section>
	);
}
