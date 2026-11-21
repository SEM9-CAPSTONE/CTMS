import { Eye } from "lucide-react";
import {
	Button,
	DataTable,
	type DataTableColumn,
	Pagination,
	StatusBadge,
} from "../../../shared/components";
import { REQUEST_STATUS_LABELS, levelName } from "../constants";
import type { RequestList } from "../request-types";

type RequestRow = RequestList["items"][number];
export function LevelRequestList({
	data,
	admin,
	page,
	onPage,
	onSelect,
}: {
	data: RequestList;
	admin: boolean;
	page: number;
	onPage: (page: number) => void;
	onSelect: (id: string) => void;
}) {
	const columns: DataTableColumn<RequestRow>[] = [
		...(admin
			? [
					{
						key: "porter",
						header: "Người hỗ trợ",
						render: (item: RequestRow) => (
							<span className="font-semibold text-[#10221b]">
								{item.porterName ?? "Người hỗ trợ"}
							</span>
						),
					},
				]
			: []),
		{
			key: "level",
			header: "Cấp đề nghị",
			render: (item) => (
				<>
					{levelName(item.currentLevel)} <span className="text-muted-foreground">→</span>{" "}
					{levelName(item.targetLevel)}
				</>
			),
		},
		{
			key: "reason",
			header: "Lý do đề nghị",
			render: (item) => (
				<span className="block max-w-xs truncate text-xs text-[#4a5e51]" title={item.reason}>
					{item.reason}
				</span>
			),
		},
		{
			key: "status",
			header: "Trạng thái",
			render: (item) => (
				<StatusBadge
					tone={
						item.status === "approved"
							? "success"
							: item.status === "rejected"
								? "danger"
								: item.status === "pending" || item.status === "needs_info"
									? "warning"
									: "neutral"
					}
				>
					{REQUEST_STATUS_LABELS[item.status]}
				</StatusBadge>
			),
		},
		{
			key: "date",
			header: "Ngày gửi",
			render: (item) => new Date(item.createdAt).toLocaleDateString("vi-VN"),
		},
		{
			key: "actions",
			header: "Thao tác",
			align: "right",
			render: (item) => (
				<Button variant="outline" onClick={() => onSelect(item.id)}>
					<Eye className="mr-2 size-4" />
					Xem yêu cầu
				</Button>
			),
		},
	];
	return (
		<div className="space-y-4">
			<DataTable
				columns={columns}
				rows={data.items}
				getRowKey={(item) => item.id}
				ariaLabel="Yêu cầu nâng cấp người hỗ trợ"
				emptyMessage="Chưa có yêu cầu phù hợp"
			/>
			<Pagination
				currentPage={page}
				totalPages={Math.max(1, Math.ceil(data.total / 20))}
				totalItems={data.total}
				itemsPerPage={20}
				onPageChange={onPage}
			/>
		</div>
	);
}
