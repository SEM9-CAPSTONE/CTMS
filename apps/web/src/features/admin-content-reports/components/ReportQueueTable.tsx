import { ChevronLeft, ChevronRight } from "lucide-react";
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
		<div>
			{data.items.length === 0 ? (
				<p className="p-16 text-center text-[#54655a]">Không có báo cáo trên trang này.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm" aria-label="Danh sách báo cáo nội dung">
						<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
							<tr>
								{["Người báo cáo", "Đối tượng", "Lý do", "Trạng thái", "Thời gian", "Thao tác"].map(
									(label) => (
										<th key={label} className="px-4 py-3 font-bold">
											{label}
										</th>
									)
								)}
							</tr>
						</thead>
						<tbody className="divide-y divide-[#e8efe7]">
							{data.items.map((report) => (
								<tr key={report.id} className="hover:bg-[#f8faf7] transition align-top">
									<td className="px-4 py-4">
										<p className="font-bold text-[#10221b]">
											{report.reporter.fullName || "Chưa cập nhật họ tên"}
										</p>
										<p className="mt-1 break-all text-xs text-[#667a6d]">{report.reporter.id}</p>
									</td>
									<td className="px-4 py-4">
										<p className="font-semibold text-[#10221b]">{report.targetType}</p>
										<p className="mt-1 break-all text-xs text-[#667a6d]">{report.targetId}</p>
									</td>
									<td className="min-w-40 max-w-xs break-words px-4 py-4">
										<p className="line-clamp-3 whitespace-pre-wrap text-xs text-[#10221b]">
											{report.reason}
										</p>
									</td>
									<td className="px-4 py-4 whitespace-nowrap">
										<ReportStatusBadge status={report.status} />
									</td>
									<td className="px-4 py-4 text-xs whitespace-nowrap text-[#667a6d]">
										<time dateTime={report.createdAt}>
											{new Date(report.createdAt).toLocaleString("vi-VN")}
										</time>
									</td>
									<td className="px-4 py-4 whitespace-nowrap">
										<button
											type="button"
											disabled={disabled}
											onClick={() => onOpen(report.id)}
											aria-label={`Xem báo cáo ${report.id}`}
											className="rounded-xl border border-[#dfe8df] bg-white px-3 py-1.5 text-xs font-bold text-[#164027] shadow-xs hover:bg-[#edf4eb] disabled:opacity-50"
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
			<div className="flex flex-col gap-3 border-t border-[#e0ebe0] px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between bg-white">
				<p>
					Tổng cộng <strong className="text-[#10221b]">{pagination.total}</strong> báo cáo
				</p>
				<div className="flex items-center gap-3">
					<button
						type="button"
						aria-label="Trang trước"
						disabled={disabled || pagination.page <= 1}
						onClick={() => onPage(pagination.page - 1)}
						className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ChevronLeft className="size-4" />
					</button>
					<span>
						Trang {pagination.page} / {Math.max(1, pagination.totalPages)}
					</span>
					<button
						type="button"
						aria-label="Trang sau"
						disabled={disabled || pagination.page >= pagination.totalPages}
						onClick={() => onPage(pagination.page + 1)}
						className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ChevronRight className="size-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
