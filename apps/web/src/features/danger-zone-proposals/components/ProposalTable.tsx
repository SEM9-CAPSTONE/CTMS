import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import {
	HAZARD_TYPE_LABELS,
	PROPOSAL_SOURCE_LABELS,
	PROPOSAL_STATUS_LABELS,
	PROPOSAL_STATUS_TONES,
	SEVERITY_LABELS,
} from "../constants";
import type { DangerZoneProposal } from "../types";
import { formatDateTime } from "../utils/proposal-errors";

interface Props {
	rows: DangerZoneProposal[];
	onOpen: (proposal: DangerZoneProposal) => void;
}

export function ProposalTable({ rows, onOpen }: Props) {
	const columns: DataTableColumn<DangerZoneProposal>[] = [
		{
			key: "hazard",
			header: "Loại nguy hiểm",
			render: (row) => (
				<div className="space-y-0.5">
					<p className="font-semibold text-[#10221b]">{HAZARD_TYPE_LABELS[row.hazardType]}</p>
					<p className="text-xs text-[#667a6d]">
						Mức độ {SEVERITY_LABELS[row.severity].toLowerCase()}
					</p>
				</div>
			),
		},
		{
			key: "route",
			header: "Tuyến",
			render: (row) => <span className="text-[#10221b]">{row.routeName}</span>,
		},
		{
			key: "source",
			header: "Nguồn",
			render: (row) => (
				<div className="space-y-0.5">
					<p className="text-[#10221b]">{PROPOSAL_SOURCE_LABELS[row.source]}</p>
					<p className="text-xs text-[#667a6d]">{row.proposerName}</p>
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
			key: "actions",
			header: "",
			align: "right",
			render: (row) => (
				<button
					type="button"
					onClick={() => onOpen(row)}
					aria-label={`Xem đề xuất ${HAZARD_TYPE_LABELS[row.hazardType].toLowerCase()} trên tuyến ${row.routeName} lúc ${formatDateTime(row.observedAt)}`}
					className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#164027] transition-colors duration-150 hover:bg-[#edf4eb]"
				>
					<Eye className="size-4" />
				</button>
			),
		},
	];
	return (
		<DataTable
			columns={columns}
			rows={rows}
			getRowKey={(row) => row.id}
			ariaLabel="Danh sách đề xuất điểm nguy hiểm"
			emptyMessage="Không có đề xuất nào ở trạng thái này."
		/>
	);
}
