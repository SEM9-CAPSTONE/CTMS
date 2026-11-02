import { Eye, RefreshCw, Trash2 } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { DataTable, type DataTableColumn } from "../../../shared/components/DataTable";
import { Pagination } from "../../../shared/components/Pagination";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import {
	incidentCategoryLabels,
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
import { IncidentSyncBadge } from "./IncidentSyncBadge";

export interface TripIncidentsTableProps {
	items: IncidentListItem[];
	currentPage: number;
	itemsPerPage?: number;
	onPageChange: (page: number) => void;
	onViewDetail: (item: IncidentListItem) => void;
	onRetry?: (id: string) => void;
	onDiscard?: (id: string) => void;
}

const STATUS_TONES: Record<IncidentStatus, StatusBadgeTone> = {
	open: "warning",
	investigating: "info",
	resolved: "success",
	closed: "neutral",
};

export function TripIncidentsTable({
	items,
	currentPage,
	itemsPerPage = 5,
	onPageChange,
	onViewDetail,
	onRetry,
	onDiscard,
}: TripIncidentsTableProps): ReactNode {
	const totalItems = items.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

	const pagedItems = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return items.slice(start, start + itemsPerPage);
	}, [items, currentPage, itemsPerPage]);

	const columns: DataTableColumn<IncidentListItem>[] = useMemo(
		() => [
			{
				key: "occurredAt",
				header: "Thời điểm",
				className: "w-[140px]",
				render: (row) => (
					<span className="text-xs text-[#667a6d]">
						{new Date(row.occurredAt).toLocaleString("vi-VN", {
							month: "2-digit",
							day: "2-digit",
							hour: "2-digit",
							minute: "2-digit",
						})}
					</span>
				),
			},
			{
				key: "category",
				header: "Phân loại",
				className: "w-[180px]",
				render: (row) => {
					const isFailed = row.syncState === IncidentSyncState.FAILED;
					const isMediaFailed = row.mediaState === IncidentMediaState.FAILED;
					return (
						<div>
							<span className="font-bold text-[#10221b]">
								{incidentCategoryLabels[row.category]}
							</span>
							{row.lastError && (
								<p
									role={isFailed || isMediaFailed ? "alert" : undefined}
									className="mt-0.5 text-[11px] font-semibold text-rose-800"
								>
									{row.lastError}
								</p>
							)}
						</div>
					);
				},
			},
			{
				key: "severity",
				header: "Mức độ",
				className: "w-[120px] whitespace-nowrap",
				render: (row) => (
					<span
						className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${incidentSeverityStyles[row.severity]}`}
					>
						{incidentSeverityLabels[row.severity]}
					</span>
				),
			},
			{
				key: "status",
				header: "Trạng thái",
				className: "w-[130px] whitespace-nowrap",
				render: (row) =>
					row.status ? (
						<StatusBadge tone={STATUS_TONES[row.status]}>
							{incidentStatusLabels[row.status]}
						</StatusBadge>
					) : (
						<span className="text-xs text-slate-400">—</span>
					),
			},
			{
				key: "assignedToName",
				header: "Người phụ trách",
				className: "min-w-[140px]",
				render: (row) =>
					row.assignedToName ? (
						<span className="font-semibold text-emerald-800">{row.assignedToName}</span>
					) : (
						<span className="italic text-slate-400">Chưa phân công</span>
					),
			},
			{
				key: "syncState",
				header: "Đồng bộ",
				className: "w-[140px] whitespace-nowrap",
				render: (row) => <IncidentSyncBadge state={row.syncState} />,
			},
			{
				key: "actions",
				header: "Thao tác",
				align: "right",
				className: "w-[100px] whitespace-nowrap",
				render: (row) => {
					const isFailed = row.syncState === IncidentSyncState.FAILED;
					const isMediaFailed = row.mediaState === IncidentMediaState.FAILED;

					return (
						<div className="flex items-center justify-end gap-1.5">
							{isFailed && onDiscard && (
								<button
									type="button"
									onClick={() => onDiscard(row.id)}
									className="cursor-pointer rounded-lg border border-red-200 p-2 text-rose-700 transition hover:bg-rose-50"
									title="Xóa khỏi thiết bị"
									aria-label="Xóa khỏi thiết bị"
								>
									<Trash2 className="size-4" />
								</button>
							)}
							{(isFailed || isMediaFailed) && onRetry && (
								<button
									type="button"
									onClick={() => onRetry(row.id)}
									className="cursor-pointer rounded-lg border border-amber-200 p-2 text-amber-700 transition hover:bg-amber-50"
									title="Thử lại"
									aria-label="Thử lại"
								>
									<RefreshCw className="size-4" />
								</button>
							)}
							<button
								type="button"
								onClick={() => onViewDetail(row)}
								className="cursor-pointer inline-flex items-center justify-center rounded-lg border border-[#dfe8df] p-2 text-[#164027] transition hover:border-[#164027]/40 hover:bg-[#eef7f0] shadow-2xs"
								title="Xem chi tiết sự cố"
								aria-label="Xem chi tiết sự cố"
							>
								<Eye className="size-4" />
							</button>
						</div>
					);
				},
			},
		],
		[onViewDetail, onRetry, onDiscard]
	);

	return (
		<div className="space-y-2">
			<DataTable
				columns={columns}
				rows={pagedItems}
				getRowKey={(row) => row.id}
				ariaLabel="Danh sách sự cố"
				emptyMessage="Không tìm thấy sự cố nào phù hợp với bộ lọc."
				minWidthClassName="min-w-[800px]"
			/>

			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				totalItems={totalItems}
				itemsPerPage={itemsPerPage}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
