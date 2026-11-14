import { CheckCircle2, Clock, Eye, Loader2, Scale } from "lucide-react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { ADJUSTMENT_TYPE_LABELS } from "../constants";
import type { FinancialAdjustmentItem } from "../types";

export interface AdminAdjustmentsTableProps {
	items: FinancialAdjustmentItem[];
	isLoading: boolean;
	onOpenDetailModal: (adjustment: FinancialAdjustmentItem) => void;
}

export function AdminAdjustmentsTable({
	items,
	isLoading,
	onOpenDetailModal,
}: AdminAdjustmentsTableProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
				<Loader2 className="size-5 animate-spin text-[#164027]" />
				<span>Đang tải khoản hoàn sau quyết toán...</span>
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="p-16 text-center">
				<Scale className="mx-auto size-10 text-[#9aaba0]" />
				<p className="mt-3 font-bold text-[#10221b]">Không tìm thấy khoản hoàn sau quyết toán</p>
				<p className="mt-1 text-sm text-[#667a6d]">Hãy thay đổi từ khóa hoặc bộ lọc và thử lại.</p>
			</div>
		);
	}

	return (
		<div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<table className="w-full text-left text-xs">
				<thead className="bg-[#f4f7f2] text-[11px] uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-3.5 py-3 font-semibold">Khách đặt chỗ</th>
						<th className="px-3.5 py-3 font-semibold">Chuyến đi</th>
						<th className="px-3.5 py-3 font-semibold">Người tổ chức</th>
						<th className="px-3.5 py-3 font-semibold">Nội dung xử lý</th>
						<th className="px-3.5 py-3 font-semibold text-right">Số tiền</th>
						<th className="px-3.5 py-3 font-semibold text-center">Trạng thái</th>
						<th className="px-3.5 py-3 font-semibold">Thời gian</th>
						<th className="px-3.5 py-3 font-semibold text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{items.map((item) => (
						<tr key={item.id} className="hover:bg-[#f8faf7] transition">
							<td className="px-3.5 py-3 text-[#10221b] whitespace-nowrap">
								<p className="font-semibold">{item.camperName}</p>
							</td>
							<td className="px-3.5 py-3 min-w-[180px]">
								<p
									className="text-xs font-semibold text-[#10221b] line-clamp-1"
									title={item.tripTitle}
								>
									{item.tripTitle}
								</p>
							</td>
							<td className="px-3.5 py-3 text-[#10221b] whitespace-nowrap">
								<p className="font-bold text-xs">{item.hostName}</p>
							</td>
							<td className="px-3.5 py-3 whitespace-nowrap">
								<span
									className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
										item.type === "post_settlement_refund"
											? "bg-rose-50 text-rose-800 border border-rose-200"
											: "bg-blue-50 text-blue-800 border border-blue-200"
									}`}
								>
									{ADJUSTMENT_TYPE_LABELS[item.type] || item.type}
								</span>
							</td>
							<td className="px-3.5 py-3 text-right font-black whitespace-nowrap text-[#164027]">
								{formatBookingMoney(item.amount)}
							</td>
							<td className="px-3.5 py-3 text-center whitespace-nowrap">
								{item.status === "resolved" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
										<CheckCircle2 className="size-3" />
										Đã xử lý
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
										<Clock className="size-3" />
										Chờ xử lý
									</span>
								)}
							</td>
							<td className="px-3.5 py-3 text-[#52665b] whitespace-nowrap text-[11px]">
								{new Date(item.createdAt).toLocaleString("vi-VN")}
							</td>
							<td className="px-3.5 py-3 text-right whitespace-nowrap">
								<div className="flex items-center justify-end gap-1.5">
									<button
										type="button"
										onClick={() => onOpenDetailModal(item)}
										title="Xem chi tiết khoản hoàn"
										aria-label={`Xem khoản hoàn của ${item.camperName} cho chuyến ${item.tripTitle}`}
										className="rounded-lg border border-[#dfe8df] p-1.5 text-[#52665b] hover:bg-[#edf3ed] hover:text-[#164027] hover:border-[#cbd9ce] transition"
									>
										<Eye className="size-3.5" />
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
