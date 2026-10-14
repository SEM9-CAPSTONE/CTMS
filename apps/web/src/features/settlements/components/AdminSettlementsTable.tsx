import { AlertTriangle, CheckCircle2, Clock, Landmark, Loader2 } from "lucide-react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { TripSettlementEvaluation } from "../types";

export interface AdminSettlementsTableProps {
	items: TripSettlementEvaluation[];
	isLoading: boolean;
	isSettling: boolean;
	onSettle: (tripId: string) => Promise<void>;
}

export function AdminSettlementsTable({
	items,
	isLoading,
	isSettling,
	onSettle,
}: AdminSettlementsTableProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
				<Loader2 className="size-5 animate-spin text-[#164027]" />
				<span>Đang tải danh sách chuyến đi...</span>
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="p-16 text-center">
				<Landmark className="mx-auto size-10 text-[#9aaba0]" />
				<p className="mt-3 font-bold text-[#10221b]">Không tìm thấy chuyến đi nào</p>
				<p className="mt-1 text-sm text-[#667a6d]">Hãy thay đổi từ khóa hoặc bộ lọc và thử lại.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[900px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3">Chuyến đi</th>
						<th className="px-4 py-3">Host</th>
						<th className="px-4 py-3 text-right">Doanh thu Base</th>
						<th className="px-4 py-3 text-right">Phí sàn 5%</th>
						<th className="px-4 py-3 text-right">Ví Host 95%</th>
						<th className="px-4 py-3 text-center">Trạng thái</th>
						<th className="px-4 py-3 text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{items.map((item) => (
						<tr key={item.tripId} className="hover:bg-[#f8faf7] transition">
							<td className="px-4 py-4 font-bold text-[#10221b] max-w-xs truncate">
								{item.tripTitle}
								<p className="text-xs text-[#7d8d83] font-normal">#{item.tripId.slice(0, 8)}</p>
							</td>
							<td className="px-4 py-4 text-[#425048] whitespace-nowrap">
								<p className="font-semibold">{item.hostName}</p>
								<p className="text-xs text-[#7d8d83]">#{item.hostId.slice(0, 8)}</p>
							</td>
							<td className="px-4 py-4 text-right font-semibold whitespace-nowrap text-[#10221b]">
								{formatBookingMoney(item.settlementBase)}
							</td>
							<td className="px-4 py-4 text-right font-semibold whitespace-nowrap text-amber-800">
								{formatBookingMoney(item.platformFee)}
							</td>
							<td className="px-4 py-4 text-right font-black whitespace-nowrap text-[#164027]">
								{formatBookingMoney(item.hostNetAmount)}
							</td>
							<td className="px-4 py-4 text-center whitespace-nowrap">
								{item.isSettled ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
										<CheckCircle2 className="size-3" />
										Đã quyết toán
									</span>
								) : item.isBlocked ? (
									<span
										title={item.blockingReasons.join("; ")}
										className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 cursor-help"
									>
										<AlertTriangle className="size-3" />
										Bị chặn khiếu nại
									</span>
								) : item.isEligible ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
										<Landmark className="size-3" />
										Đủ điều kiện
									</span>
								) : (
									<span
										title={item.blockingReasons.join("; ")}
										className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 cursor-help"
									>
										<Clock className="size-3" />
										Giữ tiền ({item.hoursSinceCompleted ?? 0}/72h)
									</span>
								)}
							</td>
							<td className="px-4 py-4 text-right whitespace-nowrap">
								{item.isEligible && !item.isSettled && (
									<button
										type="button"
										disabled={isSettling}
										onClick={() => onSettle(item.tripId)}
										className="rounded-xl bg-[#164027] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#11321f] disabled:opacity-50"
									>
										Quyết toán ngay
									</button>
								)}
								{item.isSettled && (
									<span className="text-xs text-[#7d8d83] italic">Đã hoàn tất</span>
								)}
								{!item.isEligible && !item.isSettled && (
									<span className="text-xs text-[#98a69d]">Chưa đủ điều kiện</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
