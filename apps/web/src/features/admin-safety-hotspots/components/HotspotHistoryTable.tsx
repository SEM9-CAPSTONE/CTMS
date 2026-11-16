import { DataTable, type DataTableColumn } from "../../../shared/components";
import { CORRECTIVE_ACTION_LABELS, HOTSPOT_STATUS_LABELS } from "../constants";
import type { CorrectiveAction, HotspotReview } from "../types";
import { formatDateTime } from "../utils/format";

/** One row per review decision or data update, newest first. */
interface HistoryRow {
	key: string;
	createdAt: string;
	title: string;
	detail: string | null;
	reason: string;
	actorName: string;
}

function packageNote(action: CorrectiveAction): string {
	if (action.packageImpact === "NOT_AFFECTED") return "Gói an toàn không đổi";
	if (action.impactTripCount === 0) return "Không có chuyến sắp khởi hành";
	return `Gói an toàn mới cho ${action.impactTripCount} chuyến`;
}

function toRows(reviews: HotspotReview[], actions: CorrectiveAction[]): HistoryRow[] {
	const reviewRows = reviews.map<HistoryRow>((review) => ({
		key: `review:${review.id}`,
		createdAt: review.createdAt,
		title: HOTSPOT_STATUS_LABELS[review.toStatus],
		detail: null,
		reason: review.reason,
		actorName: review.actorName,
	}));
	const actionRows = actions.map<HistoryRow>((action) => ({
		key: `action:${action.id}`,
		createdAt: action.createdAt,
		title: CORRECTIVE_ACTION_LABELS[action.actionType],
		detail: [action.targetName, packageNote(action)].filter(Boolean).join(" · "),
		reason: action.reason,
		actorName: action.actorName ?? "Quản trị viên",
	}));
	return [...reviewRows, ...actionRows].sort(
		(left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
	);
}

const columns: DataTableColumn<HistoryRow>[] = [
	{
		key: "createdAt",
		header: "Thời gian",
		className: "whitespace-nowrap",
		render: (row) => (
			<span className="text-xs text-[#667a6d]">{formatDateTime(row.createdAt)}</span>
		),
	},
	{
		key: "title",
		header: "Nội dung",
		render: (row) => (
			<div className="space-y-0.5">
				<p className="font-semibold text-[#10221b]">{row.title}</p>
				{row.detail && <p className="text-xs text-[#667a6d]">{row.detail}</p>}
			</div>
		),
	},
	{
		key: "reason",
		header: "Lý do",
		className: "max-w-[280px]",
		render: (row) => <p className="whitespace-pre-wrap break-words text-[#10221b]">{row.reason}</p>,
	},
	{
		key: "actor",
		header: "Người thực hiện",
		className: "whitespace-nowrap",
		render: (row) => <span className="text-[#10221b]">{row.actorName}</span>,
	},
];

export function HotspotHistoryTable({
	reviews,
	actions,
}: {
	reviews: HotspotReview[];
	actions: CorrectiveAction[];
}) {
	return (
		<DataTable
			columns={columns}
			rows={toRows(reviews, actions)}
			getRowKey={(row) => row.key}
			ariaLabel="Lịch sử điểm nóng"
			emptyMessage="Chưa có lịch sử xét duyệt hoặc cập nhật."
		/>
	);
}
