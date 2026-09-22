import type { ReportQueue } from "../types";
import { ReportStatusBadge } from "./ReportStatusBadge";

interface Props {
	data: ReportQueue;
	disabled: boolean;
	onOpen: (id: string) => void;
	onPage: (page: number) => void;
}
export function ReportQueueTable({ data, disabled, onOpen, onPage }: Props) {
	const { pagination } = data;
	return (
		<div className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-sm">
			{data.items.length === 0 ? (
				<p className="p-12 text-center text-[#54655a]">Không có báo cáo trên trang này.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm" aria-label="Danh sách báo cáo nội dung">
						<thead className="bg-[#f1f5f0] text-[#54655a]">
							<tr>
								{["Người báo cáo", "Đối tượng", "Lý do", "Trạng thái", "Thời gian", "Chi tiết"].map(
									(label) => (
										<th key={label} className="px-4 py-3 font-bold">
											{label}
										</th>
									)
								)}
							</tr>
						</thead>
						<tbody>
							{data.items.map((report) => (
								<tr key={report.id} className="border-t border-[#e7eee7] align-top">
									<td className="px-4 py-4">
										<p className="font-semibold">
											{report.reporter.fullName || "Chưa cập nhật họ tên"}
										</p>
										<p className="mt-1 break-all text-xs text-[#667a6d]">{report.reporter.id}</p>
									</td>
									<td className="px-4 py-4">
										<p>{report.targetType}</p>
										<p className="mt-1 break-all text-xs text-[#667a6d]">{report.targetId}</p>
									</td>
									<td className="min-w-40 max-w-xs break-words px-4 py-4">
										<p className="line-clamp-3 whitespace-pre-wrap">{report.reason}</p>
									</td>
									<td className="px-4 py-4">
										<ReportStatusBadge status={report.status} />
									</td>
									<td className="px-4 py-4 text-xs">
										<time dateTime={report.createdAt}>
											{new Date(report.createdAt).toLocaleString("vi-VN")}
										</time>
									</td>
									<td className="px-4 py-4">
										<button
											type="button"
											disabled={disabled}
											onClick={() => onOpen(report.id)}
											aria-label={`Xem báo cáo ${report.id}`}
											className="rounded-lg border border-[#cbdaca] px-3 py-2 font-bold text-[#164027] hover:bg-[#edf4eb] disabled:opacity-50"
										>
											Xem
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7eee7] p-4 text-sm">
				<p>
					Tổng cộng <strong>{pagination.total}</strong> báo cáo
				</p>
				<div className="flex items-center gap-3">
					<button
						type="button"
						aria-label="Trang trước"
						disabled={disabled || pagination.page <= 1}
						onClick={() => onPage(pagination.page - 1)}
						className="rounded-lg border px-3 py-2 disabled:opacity-40"
					>
						Trước
					</button>
					<span>
						Trang {pagination.page} / {Math.max(1, pagination.totalPages)}
					</span>
					<button
						type="button"
						aria-label="Trang sau"
						disabled={disabled || pagination.page >= pagination.totalPages}
						onClick={() => onPage(pagination.page + 1)}
						className="rounded-lg border px-3 py-2 disabled:opacity-40"
					>
						Sau
					</button>
				</div>
			</div>
		</div>
	);
}
