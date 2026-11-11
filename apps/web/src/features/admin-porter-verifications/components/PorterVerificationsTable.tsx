import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn, StatusBadge } from "../../../shared/components";
import {
	PORTER_VERIFICATION_STATUS_LABELS,
	PORTER_VERIFICATION_STATUS_TONES,
} from "../../porter-verification/constants";
import type { AdminPorterVerificationSummary } from "../types";

export interface PorterVerificationsTableProps {
	items: AdminPorterVerificationSummary[];
	onView: (porterId: string) => void;
}

function formatDateTime(value: string | null): string {
	return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

export function PorterVerificationsTable({ items, onView }: PorterVerificationsTableProps) {
	const columns: DataTableColumn<AdminPorterVerificationSummary>[] = [
		{
			key: "porter",
			header: "Porter",
			render: (row) => (
				<div className="min-w-0">
					<p className="truncate font-bold text-[#10221b]">{row.fullName ?? "Chưa cập nhật tên"}</p>
					<p className="truncate text-xs text-[#667a6d]">
						{[row.email, row.phone].filter(Boolean).join(" · ") || "—"}
					</p>
				</div>
			),
		},
		{
			key: "status",
			header: "Trạng thái",
			render: (row) => (
				<StatusBadge tone={PORTER_VERIFICATION_STATUS_TONES[row.status]}>
					{PORTER_VERIFICATION_STATUS_LABELS[row.status]}
				</StatusBadge>
			),
		},
		{
			key: "documents",
			header: "Tài liệu",
			align: "center",
			render: (row) => <span className="font-bold">{row.documentCount}</span>,
		},
		{
			key: "submittedAt",
			header: "Ngày nộp",
			render: (row) => <span className="text-xs">{formatDateTime(row.submittedAt)}</span>,
		},
		{
			key: "actions",
			header: "Thao tác",
			align: "right",
			render: (row) => (
				<button
					type="button"
					onClick={() => onView(row.porterId)}
					className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] px-3 py-1.5 text-xs font-bold text-[#164027] transition hover:bg-[#eef7f0]"
				>
					<Eye className="size-4" />
					{row.status === "pending_review" ? "Xem & duyệt" : "Xem hồ sơ"}
				</button>
			),
		},
	];

	return (
		<DataTable
			columns={columns}
			rows={items}
			getRowKey={(row) => row.porterId}
			getRowTestId={(row) => `porter-verification-row-${row.porterId}`}
			ariaLabel="Danh sách hồ sơ xác minh Porter"
			minWidthClassName="min-w-[760px]"
		/>
	);
}
