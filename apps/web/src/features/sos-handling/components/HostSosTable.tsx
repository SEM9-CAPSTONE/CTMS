import { ChevronLeft, ChevronRight, Eye, ShieldAlert } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import type { EmergencyType, SosAlertItem, SosStatus } from "../types";

export interface HostSosTableProps {
	items: SosAlertItem[];
	total: number;
	page: number;
	limit: number;
	onPageChange: (newPage: number) => void;
	onViewDetail: (item: SosAlertItem) => void;
	isLoading?: boolean;
}

const EMERGENCY_LABELS: Record<EmergencyType, string> = {
	medical: "Sự cố y tế",
	injury: "Chấn thương",
	lost: "Lạc đường",
	natural_hazard: "Thiên tai / Sạt lở",
	other: "Khẩn cấp khác",
};

const STATUS_BADGES: Record<SosStatus, { label: string; className: string }> = {
	active: { label: "Cần tiếp nhận", className: "bg-red-100 text-red-700 border-red-200" },
	acknowledged: {
		label: "Đang hỗ trợ",
		className: "bg-amber-100 text-amber-800 border-amber-200",
	},
	closed: {
		label: "Đã giải quyết",
		className: "bg-emerald-100 text-emerald-800 border-emerald-200",
	},
	cancelled: { label: "Đã hủy", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function HostSosTable({
	items,
	total,
	page,
	limit,
	onPageChange,
	onViewDetail,
	isLoading,
}: HostSosTableProps) {
	const totalPages = Math.max(1, Math.ceil(total / limit));

	if (isLoading) {
		return (
			<div className="rounded-2xl border border-[#dfe8df] bg-white p-12 text-center text-sm font-semibold text-[#627769] shadow-xs">
				Đang tải danh sách cứu trợ...
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="rounded-2xl border border-[#dfe8df] bg-white p-12 text-center shadow-xs">
				<ShieldAlert className="mx-auto size-10 text-[#8fa096]" />
				<h4 className="mt-3 text-sm font-bold text-[#10221b]">
					Không có yêu cầu cứu trợ nào phù hợp
				</h4>
				<p className="mt-1 text-xs text-[#627769]">
					Các tín hiệu khẩn cấp phát sinh sẽ tự động hiển thị tại đây.
				</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs">
			<div className="overflow-x-auto">
				<table className="w-full text-left text-xs">
					<thead className="border-b border-[#e7eee7] bg-[#f8faf7] font-bold text-[#55685a] uppercase tracking-wider text-[11px]">
						<tr>
							<th className="py-3.5 pr-3 pl-4">Thời gian</th>
							<th className="px-3 py-3.5">Phân loại</th>
							<th className="px-3 py-3.5">Người gửi</th>
							<th className="px-3 py-3.5">Chuyến đi</th>
							<th className="px-3 py-3.5">Trạng thái</th>
							<th className="py-3.5 pr-4 pl-3 text-right">Thao tác</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-[#e7eee7] text-[#10221b]">
						{items.map((item) => {
							const statusBadge = STATUS_BADGES[item.status] || {
								label: item.status,
								className: "bg-gray-100 text-gray-700 border-gray-200",
							};
							const emergency = EMERGENCY_LABELS[item.emergencyType] || "Khẩn cấp";

							return (
								<tr key={item.id} className="transition hover:bg-[#f8faf7]">
									<td className="py-3 pr-3 pl-4 font-semibold whitespace-nowrap">
										<p>
											{new Date(item.eventTime).toLocaleTimeString("vi-VN", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
										<p className="text-[11px] text-[#627769]">
											{new Date(item.eventTime).toLocaleDateString("vi-VN")}
										</p>
									</td>
									<td className="px-3 py-3 font-bold text-red-700 whitespace-nowrap">
										{emergency}
									</td>
									<td className="px-3 py-3">
										<p className="font-bold line-clamp-1">{item.senderName || "Camper"}</p>
										{item.senderEmail && (
											<p className="text-[11px] text-[#627769] font-mono line-clamp-1">
												{item.senderEmail}
											</p>
										)}
									</td>
									<td className="px-3 py-3 max-w-[200px]">
										<p className="font-semibold line-clamp-1">
											{item.tripTitle || "Chưa cập nhật tên chuyến đi"}
										</p>
									</td>
									<td className="px-3 py-3 whitespace-nowrap">
										<span
											className={`inline-block rounded-xl border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.className}`}
										>
											{statusBadge.label}
										</span>
									</td>
									<td className="py-3 pr-4 pl-3 text-right whitespace-nowrap">
										<div className="flex items-center justify-end">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => onViewDetail(item)}
												aria-label="Xem chi tiết"
												className="px-2.5 py-1 text-[#164027] hover:bg-[#edf4ea] hover:text-[#164027]"
												title="Xem chi tiết"
											>
												<Eye className="size-4" />
											</Button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Pagination Footer */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#e7eee7] px-4 py-3 text-xs text-[#55685a]">
				<p>
					Hiển thị <span className="font-bold text-[#10221b]">{items.length}</span> trên tổng số{" "}
					<span className="font-bold text-[#10221b]">{total}</span> yêu cầu
				</p>
				<div className="flex items-center gap-1.5">
					<Button
						size="sm"
						variant="outline"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
						className="px-2.5 py-1"
					>
						<ChevronLeft className="size-4 mr-0.5" />
						<span>Trước</span>
					</Button>
					<span className="px-2 font-bold text-[#10221b]">
						{page} / {totalPages}
					</span>
					<Button
						size="sm"
						variant="outline"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
						className="px-2.5 py-1"
					>
						<span>Sau</span>
						<ChevronRight className="size-4 ml-0.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}
