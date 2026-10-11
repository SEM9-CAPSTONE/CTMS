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
			<div className="flex h-64 items-center justify-center rounded-2xl border border-[#cbd9ce] bg-white">
				<p className="text-sm font-semibold text-[#667a6d]">
					Đang tải danh sách yêu cầu hoàn tiền...
				</p>
			</div>
		);
	}

	if (refunds.length === 0) {
		return (
			<div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-[#cbd9ce] bg-white p-6 text-center">
				<p className="text-base font-bold text-[#10221b]">Không tìm thấy yêu cầu hoàn tiền nào</p>
				<p className="mt-1 text-xs text-[#667a6d]">
					Hiện chưa có yêu cầu hoàn tiền nào khớp với bộ lọc.
				</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-2xl border border-[#cbd9ce] bg-white shadow-sm">
			<table className="w-full text-left text-xs">
				<thead className="border-b border-[#edf3ed] bg-[#f8faf8] font-bold text-[#164027]">
					<tr>
						<th className="p-3.5">Khách hàng</th>
						<th className="p-3.5">Số tiền</th>
						<th className="p-3.5">Tài khoản nhận tiền</th>
						<th className="p-3.5">Lý do yêu cầu</th>
						<th className="p-3.5">Trạng thái</th>
						<th className="p-3.5">Đối soát / Ghi chú</th>
						<th className="p-3.5">Thời gian</th>
						<th className="p-3.5 text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#edf3ed]">
					{refunds.map((refund) => (
						<tr key={refund.id} className="hover:bg-[#fbfcfb] transition-colors">
							<td className="p-3.5">
								<p className="font-bold text-[#10221b]">{refund.camper.fullName}</p>
								{refund.camper.email && (
									<p className="text-[11px] text-[#667a6d]">{refund.camper.email}</p>
								)}
								{refund.camper.phone && (
									<p className="text-[11px] text-[#667a6d]">{refund.camper.phone}</p>
								)}
							</td>

							<td className="p-3.5">
								<span className="font-bold text-[#164027] text-sm">
									{formatBookingMoney(refund.amount)}
								</span>
							</td>

							<td className="p-3.5">
								{refund.beneficiary?.bankName ? (
									<div className="space-y-0.5">
										<p className="font-semibold text-[#10221b]">{refund.beneficiary.bankName}</p>
										<p className="text-[11px] text-[#52665b]">
											STK: <strong>{refund.beneficiary.accountNumber}</strong>
										</p>
										<p className="text-[11px] uppercase text-[#667a6d]">
											{refund.beneficiary.accountHolderName}
										</p>
									</div>
								) : (
									<span className="text-gray-400 italic">Chưa có thông tin NH</span>
								)}
							</td>

							<td className="p-3.5 max-w-[200px]">
								<p className="text-xs text-[#10221b] truncate" title={refund.reason ?? ""}>
									{refund.reason || "-"}
								</p>
							</td>

							<td className="p-3.5">
								<RefundStateBadge status={refund.status} />
							</td>

							<td className="p-3.5 max-w-[200px]">
								{refund.providerReference && (
									<p className="text-[11px] font-semibold text-[#164027]">
										Mã GD: {refund.providerReference}
									</p>
								)}
								{refund.note && (
									<p className="text-[11px] text-[#52665b] truncate" title={refund.note}>
										{refund.note}
									</p>
								)}
								{refund.rejectionReason && (
									<p className="text-[11px] text-rose-600 truncate" title={refund.rejectionReason}>
										Từ chối: {refund.rejectionReason}
									</p>
								)}
								{!refund.providerReference && !refund.note && !refund.rejectionReason && (
									<span className="text-gray-400">-</span>
								)}
							</td>

							<td className="p-3.5 whitespace-nowrap text-[#667a6d]">
								{formatBookingDateTime(refund.createdAt)}
							</td>

							<td className="p-3.5 text-right whitespace-nowrap">
								{refund.status === "pending" ? (
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={() => onOpenConfirm(refund)}
											className="rounded-lg bg-[#164027] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#123320] transition-colors"
										>
											Xác nhận chuyển
										</button>
										<button
											type="button"
											onClick={() => onOpenReject(refund)}
											className="rounded-lg border border-rose-600 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
										>
											Từ chối
										</button>
									</div>
								) : (
									<span className="text-[11px] text-[#667a6d] italic">Đã xử lý</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
