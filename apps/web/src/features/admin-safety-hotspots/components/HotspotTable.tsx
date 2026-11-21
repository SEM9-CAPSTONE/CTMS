import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import { HOTSPOT_STATUS_LABELS, HOTSPOT_STATUS_TONES } from "../constants";
import type { SafetyHotspot } from "../types";
import { formatDate } from "../utils/format";

interface Props {
	rows: SafetyHotspot[];
	onOpen: (hotspot: SafetyHotspot) => void;
}

export function HotspotTable({ rows, onOpen }: Props) {
	const columns: DataTableColumn<SafetyHotspot>[] = [
		{
			key: "route",
			header: "Điểm nóng",
			render: (row) => (
				<div>
					<p className="font-semibold text-[#10221b]">{row.name ?? row.routeName}</p>
					{row.name && <p className="text-xs text-[#667a6d]">{row.routeName}</p>}
				</div>
			),
		},
		{
			key: "evidence",
			header: "Bằng chứng",
			render: (row) => (
				<span className="text-[#10221b]">
					{row.eventCount} lần lệch tuyến · {row.distinctTripCount} chuyến
				</span>
			),
		},
		{
			key: "period",
			header: "Khoảng thời gian",
			render: (row) => (
				<span className="whitespace-nowrap text-xs text-[#667a6d]">
					{formatDate(row.firstEventAt)} – {formatDate(row.lastEventAt)}
				</span>
			),
		},
		{
			key: "status",
			header: "Trạng thái",
			render: (row) => (
				<StatusBadge tone={HOTSPOT_STATUS_TONES[row.status]}>
					{HOTSPOT_STATUS_LABELS[row.status]}
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
					aria-label={`Xem điểm nóng trên tuyến ${row.routeName} phát hiện ngày ${formatDate(row.detectedAt)}`}
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
			ariaLabel="Danh sách điểm nóng an toàn"
			emptyMessage="Chưa có điểm nóng nào ở trạng thái này."
		/>
	);
}
