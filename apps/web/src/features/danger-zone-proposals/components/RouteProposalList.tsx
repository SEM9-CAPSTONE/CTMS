import { DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import {
	HAZARD_TYPE_LABELS,
	PROPOSAL_SOURCE_LABELS,
	PROPOSAL_STATUS_LABELS,
	PROPOSAL_STATUS_TONES,
} from "../constants";
import type { DangerZoneProposal } from "../types";
import { formatDateTime } from "../utils/proposal-errors";

const columns: DataTableColumn<DangerZoneProposal>[] = [
	{
		key: "hazard",
		header: "Loại nguy hiểm",
		render: (row) => (
			<div className="space-y-0.5">
				<p className="font-semibold text-[#10221b]">{HAZARD_TYPE_LABELS[row.hazardType]}</p>
				<p className="text-xs text-[#667a6d]">{PROPOSAL_SOURCE_LABELS[row.source]}</p>
			</div>
		),
	},
	{
		key: "observedAt",
		header: "Thời điểm",
		className: "whitespace-nowrap",
		render: (row) => (
			<span className="text-xs text-[#667a6d]">{formatDateTime(row.observedAt)}</span>
		),
	},
	{
		key: "status",
		header: "Trạng thái",
		render: (row) => (
			<StatusBadge tone={PROPOSAL_STATUS_TONES[row.status]}>
				{PROPOSAL_STATUS_LABELS[row.status]}
			</StatusBadge>
		),
	},
	{
		key: "reason",
		header: "Lý do",
		className: "max-w-[280px]",
		render: (row) => (
			<p className="whitespace-pre-wrap break-words text-[#10221b]">{row.reviewReason ?? ""}</p>
		),
	},
];

export function RouteProposalList({ rows }: { rows: DangerZoneProposal[] }) {
	return (
		<DataTable
			columns={columns}
			rows={rows}
			getRowKey={(row) => row.id}
			ariaLabel="Đề xuất điểm nguy hiểm của tuyến"
			emptyMessage="Tuyến chưa có đề xuất nào."
		/>
	);
}
