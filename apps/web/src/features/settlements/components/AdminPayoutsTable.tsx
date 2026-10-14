import { CheckCircle2, Clock, Loader2, Wallet, XCircle } from "lucide-react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminPayoutItem } from "../types";

export interface AdminPayoutsTableProps {
	items: AdminPayoutItem[];
	isLoading: boolean;
	onOpenConfirmModal: (payout: AdminPayoutItem) => void;
	onOpenRejectModal: (payout: AdminPayoutItem) => void;
}

export function AdminPayoutsTable({
	items,
	isLoading,
	onOpenConfirmModal,
	onOpenRejectModal,
}: AdminPayoutsTableProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
				<Loader2 className="size-5 animate-spin text-[#164027]" />
				<span>Đang tải danh sách yêu cầu rút tiền...</span>
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="p-16 text-center">
				<Wallet className="mx-auto size-10 text-[#9aaba0]" />
				<p className="mt-3 font-bold text-[#10221b]">Không tìm thấy yêu cầu rút tiền nào</p>
				<p className="mt-1 text-sm text-[#667a6d]">Hãy thay đổi từ khóa hoặc bộ lọc và thử lại.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[900px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3">Thời gian</th>
						<th className="px-4 py-3">Host</th>
						<th className="px-4 py-3 text-right">Số tiền rút</th>
						<th className="px-4 py-3">Thông tin ngân hàng</th>
						<th className="px-4 py-3 text-center">Trạng thái</th>
						<th className="px-4 py-3">Mã GD / Lý do</th>
						<th className="px-4 py-3 text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{items.map((item) => (
						<tr key={item.id} className="hover:bg-[#f8faf7] transition">
							<td className="px-4 py-4 text-[#52665b] whitespace-nowrap">
								{new Date(item.createdAt).toLocaleString("vi-VN")}
							</td>
							<td className="px-4 py-4 text-[#10221b] whitespace-nowrap">
								<p className="font-bold">{item.hostName}</p>
								<p className="text-xs text-[#7d8d83]">
									{item.hostEmail || item.hostPhone || `#${item.hostId.slice(0, 8)}`}
								</p>
							</td>
							<td className="px-4 py-4 text-right font-black whitespace-nowrap text-[#164027]">
								{formatBookingMoney(item.amount)}
							</td>
							<td className="px-4 py-4 text-[#425048]">
								<p className="font-bold text-[#10221b]">{item.bankName}</p>
								<p className="text-xs font-mono font-medium">{item.accountNumber}</p>
								<p className="text-xs text-[#7d8d83] uppercase">{item.accountHolderName}</p>
							</td>
							<td className="px-4 py-4 text-center whitespace-nowrap">
								{item.status === "succeeded" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
										<CheckCircle2 className="size-3" />
										Đã chuyển tiền
									</span>
								) : item.status === "failed" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
										<XCircle className="size-3" />
										Đã từ chối
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
										<Clock className="size-3" />
										Chờ chuyển tiền
									</span>
								)}
							</td>
							<td className="px-4 py-4 text-[#425048] max-w-xs">
								{item.transactionRef && (
									<p className="font-mono font-bold text-emerald-900 truncate">
										Mã GD: {item.transactionRef}
									</p>
								)}
								{item.rejectionReason && (
									<p className="text-rose-700 truncate" title={item.rejectionReason}>
										{item.rejectionReason}
									</p>
								)}
								{item.adminNotes && (
									<p className="text-xs text-[#7d8d83] italic truncate">{item.adminNotes}</p>
								)}
							</td>
							<td className="px-4 py-4 text-right whitespace-nowrap">
								{item.status === "pending" ? (
									<div className="flex items-center justify-end gap-2">
										<button
											type="button"
											onClick={() => onOpenRejectModal(item)}
											className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
										>
											Từ chối
										</button>
										<button
											type="button"
											onClick={() => onOpenConfirmModal(item)}
											className="rounded-xl bg-[#164027] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#11321f]"
										>
											Xác nhận chuyển
										</button>
									</div>
								) : (
									<span className="text-xs text-[#7d8d83] italic">Đã xử lý</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
