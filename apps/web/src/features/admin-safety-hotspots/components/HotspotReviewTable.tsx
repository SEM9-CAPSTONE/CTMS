import { DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import { HOTSPOT_STATUS_LABELS, HOTSPOT_STATUS_TONES } from "../constants";
import type { HotspotReview } from "../types";
import { formatDateTime } from "../utils/format";

const columns: DataTableColumn<HotspotReview>[] = [
	{
		key: "createdAt",
		header: "Thời gian",
		className: "whitespace-nowrap",
		render: (review) => (
			<span className="text-xs text-[#667a6d]">{formatDateTime(review.createdAt)}</span>
		),
	},
	{
		key: "status",
		header: "Kết quả",
		className: "whitespace-nowrap",
		render: (review) => (
			<StatusBadge tone={HOTSPOT_STATUS_TONES[review.toStatus]}>
				{HOTSPOT_STATUS_LABELS[review.toStatus]}
			</StatusBadge>
		),
	},
	{
		key: "reason",
		header: "Lý do",
		className: "max-w-[320px]",
		render: (review) => (
			<p className="whitespace-pre-wrap break-words text-[#10221b]">{review.reason}</p>
		),
	},
	{
		key: "actor",
		header: "Người xét duyệt",
		className: "whitespace-nowrap",
		render: (review) => <span className="text-[#10221b]">{review.actorName}</span>,
	},
];

export function HotspotReviewTable({ rows }: { rows: HotspotReview[] }) {
	return (
		<DataTable
			columns={columns}
			rows={rows}
			getRowKey={(review) => review.id}
			ariaLabel="Lịch sử xét duyệt điểm nóng"
			emptyMessage="Chưa có lần xét duyệt nào."
		/>
	);
}
