import { Loader2, ReceiptText } from "lucide-react";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import { RefundStateBadge } from "../../booking-refund/components/RefundStateBadge";
import type { AdminRefundItem } from "../types";

export interface AdminRefundsTableProps {
	refunds: AdminRefundItem[];
	isLoading: boolean;
	onOpenConfirm: (item: AdminRefundItem) => void;
	onOpenReject: (item: AdminRefundItem) => void;
}

export function AdminRefundsTable({
	refunds,
	isLoading,
	onOpenConfirm,
	onOpenReject,
}: AdminRefundsTableProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
				<Loader2 className="size-5 animate-spin text-[#164027]" />
				<span>Đang tải danh sách yêu cầu hoàn tiền...</span>
			</div>
		);
	}

	if (refunds.length === 0) {
		return (
			<div className="p-16 text-center">
				<ReceiptText className="mx-auto size-10 text-[#9aaba0]" />
				<p className="mt-3 font-bold text-[#10221b]">Không tìm thấy yêu cầu hoàn tiền nào</p>
				<p className="mt-1 text-sm text-[#667a6d]">Hãy thay đổi từ khóa hoặc bộ lọc và thử lại.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[960px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
						<th className="px-4 py-3 whitespace-nowrap">Khách hàng</th>
						<th className="px-4 py-3 whitespace-nowrap text-right">Số tiền hoàn</th>
						<th className="px-4 py-3 whitespace-nowrap">Tài khoản nhận tiền</th>
						<th className="px-4 py-3 whitespace-nowrap">Lý do hoàn</th>
						<th className="px-4 py-3 whitespace-nowrap text-center">Trạng thái</th>
						<th className="px-4 py-3 whitespace-nowrap">Đối soát / Ghi chú</th>
						<th className="px-4 py-3 whitespace-nowrap text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{refunds.map((refund) => (
						<tr key={refund.id} className="hover:bg-[#f8faf7] transition">
							<td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#667a6d]">
								{formatBookingDateTime(refund.createdAt)}
							</td>

							<td className="px-4 py-3.5 whitespace-nowrap">
								<p className="font-bold text-[#10221b]">{refund.camper.fullName}</p>
								<p className="text-xs text-[#7d8d83]">
									{refund.camper.email || refund.camper.phone || `#${refund.camper.id.slice(0, 8)}`}
								</p>
							</td>

							<td className="px-4 py-3.5 text-right font-black whitespace-nowrap text-[#164027]">
								{formatBookingMoney(refund.amount)}
							</td>

							<td className="px-4 py-3.5 whitespace-nowrap">
								{refund.beneficiary?.bankName ? (
									<div>
										<p className="font-bold text-[#10221b]">{refund.beneficiary.bankName}</p>
										<p className="text-xs font-mono font-medium text-[#425048]">
											{refund.beneficiary.accountNumber}
										</p>
										<p className="text-xs uppercase text-[#7d8d83]">
											{refund.beneficiary.accountHolderName}
										</p>
									</div>
								) : (
									<span className="text-xs text-gray-400 italic">Chưa có thông tin NH</span>
								)}
							</td>

							<td className="px-4 py-3.5 max-w-[180px]">
								<p className="text-xs text-[#10221b] line-clamp-2" title={refund.reason ?? ""}>
									{refund.reason || "-"}
								</p>
							</td>

							<td className="px-4 py-3.5 text-center whitespace-nowrap">
								<RefundStateBadge status={refund.status} />
							</td>

							<td className="px-4 py-3.5 max-w-[200px]">
								{refund.providerReference && (
									<p
										className="font-mono text-xs font-bold text-emerald-900 truncate"
										title={refund.providerReference}
									>
										Mã GD: {refund.providerReference}
									</p>
								)}
								{refund.note && (
									<p className="text-xs text-[#52665b] truncate" title={refund.note}>
										{refund.note}
									</p>
								)}
								{refund.rejectionReason && (
									<p
										className="text-xs font-semibold text-rose-600 truncate"
										title={refund.rejectionReason}
									>
										Từ chối: {refund.rejectionReason}
									</p>
								)}
								{!refund.providerReference && !refund.note && !refund.rejectionReason && (
									<span className="text-gray-400">-</span>
								)}
							</td>

							<td className="px-4 py-3.5 text-right whitespace-nowrap">
								{refund.status === "pending" ? (
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={() => onOpenReject(refund)}
											className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
										>
											Từ chối
										</button>
										<button
											type="button"
											onClick={() => onOpenConfirm(refund)}
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
