import { DataTable, type DataTableColumn } from "../../../shared/components";
import { CORRECTIVE_ACTION_LABELS } from "../constants";
import type { CorrectiveAction } from "../types";
import { formatDateTime } from "../utils/format";

function packageNote(action: CorrectiveAction): string {
	if (action.packageImpact === "NOT_AFFECTED") return "Không ảnh hưởng";
	if (action.impactTripCount === 0) return "Không có chuyến sắp khởi hành";
	return `Phiên bản mới cho ${action.impactTripCount} chuyến`;
}

const columns: DataTableColumn<CorrectiveAction>[] = [
	{
		key: "createdAt",
		header: "Thời gian",
		className: "whitespace-nowrap",
		render: (action) => (
			<span className="text-xs text-[#667a6d]">{formatDateTime(action.createdAt)}</span>
		),
	},
	{
		key: "action",
		header: "Biện pháp",
		render: (action) => (
			<div className="space-y-0.5">
				<p className="font-semibold text-[#10221b]">
					{CORRECTIVE_ACTION_LABELS[action.actionType]}
				</p>
				{action.targetName && <p className="text-xs text-[#667a6d]">{action.targetName}</p>}
			</div>
		),
	},
	{
		key: "reason",
		header: "Lý do",
		className: "max-w-[280px]",
		render: (action) => (
			<p className="whitespace-pre-wrap break-words text-[#10221b]">{action.reason}</p>
		),
	},
	{
		key: "actor",
		header: "Người thực hiện",
		className: "whitespace-nowrap",
		render: (action) => (
			<span className="text-[#10221b]">{action.actorName ?? "Quản trị viên"}</span>
		),
	},
	{
		key: "package",
		header: "Gói an toàn",
		className: "whitespace-nowrap",
		render: (action) => <span className="text-[#10221b]">{packageNote(action)}</span>,
	},
];

export function HotspotHistoryTable({ rows }: { rows: CorrectiveAction[] }) {
	return (
		<DataTable
			columns={columns}
			rows={rows}
			getRowKey={(action) => action.id}
			ariaLabel="Lịch sử cập nhật dữ liệu an toàn"
			emptyMessage="Chưa có cập nhật nào từ điểm nóng này."
		/>
	);
}
