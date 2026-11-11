import { AlertTriangle, CheckCircle2, Clock, Eye, Landmark, Loader2 } from "lucide-react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { TripSettlementEvaluation } from "../types";

export interface AdminSettlementsTableProps {
	items: TripSettlementEvaluation[];
	isLoading: boolean;
	isSettling: boolean;
	onSettle: (tripId: string) => Promise<void>;
	onViewTrip: (item: TripSettlementEvaluation) => void;
}

export function AdminSettlementsTable({
	items,
	isLoading,
	isSettling,
	onSettle,
	onViewTrip,
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
		<div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<table className="w-full text-left text-xs">
				<thead className="bg-[#f4f7f2] text-[11px] uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-3.5 py-3 font-semibold">Chuyến đi</th>
						<th className="px-3.5 py-3 font-semibold">Host</th>
						<th className="px-3.5 py-3 font-semibold text-right">Doanh thu Base</th>
						<th className="px-3.5 py-3 font-semibold text-right">Phí sàn 5%</th>
						<th className="px-3.5 py-3 font-semibold text-right">Ví Host 95%</th>
						<th className="px-3.5 py-3 font-semibold text-center">Trạng thái</th>
						<th className="px-3.5 py-3 font-semibold text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{items.map((item) => (
						<tr key={item.tripId} className="hover:bg-[#f8faf7] transition">
							<td className="px-3.5 py-3">
								<div className="min-w-0">
									<p
										className="text-xs font-semibold text-[#10221b] line-clamp-1 hover:text-[#164027] transition"
										title={item.tripTitle}
									>
										{item.tripTitle}
									</p>
									<p className="text-[11px] text-[#7d8d83] font-mono">#{item.tripId.slice(0, 8)}</p>
								</div>
							</td>
							<td className="px-3.5 py-3 text-[#425048] whitespace-nowrap">
								<p className="font-semibold text-xs text-[#10221b]">{item.hostName}</p>
								<p className="text-[11px] text-[#7d8d83]">#{item.hostId.slice(0, 8)}</p>
							</td>
							<td className="px-3.5 py-3 text-right font-medium whitespace-nowrap text-[#10221b]">
								{formatBookingMoney(item.settlementBase)}
							</td>
							<td className="px-3.5 py-3 text-right font-medium whitespace-nowrap text-amber-800">
								{formatBookingMoney(item.platformFee)}
							</td>
							<td className="px-3.5 py-3 text-right font-bold whitespace-nowrap text-[#164027]">
								{formatBookingMoney(item.hostNetAmount)}
							</td>
							<td className="px-3.5 py-3 text-center whitespace-nowrap">
								{item.isSettled ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
										<CheckCircle2 className="size-3" />
										Đã quyết toán
									</span>
								) : item.isBlocked ? (
									<span
										title={item.blockingReasons.join("; ")}
										className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 cursor-help"
									>
										<AlertTriangle className="size-3" />
										Bị chặn khiếu nại
									</span>
								) : item.isEligible ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
										<Landmark className="size-3" />
										Đủ điều kiện
									</span>
								) : (
									<span
										title={item.blockingReasons.join("; ")}
										className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 cursor-help"
									>
										<Clock className="size-3" />
										Giữ tiền ({item.hoursSinceCompleted ?? 0}/72h)
									</span>
								)}
							</td>
							<td className="px-3.5 py-3 text-right whitespace-nowrap">
								<div className="flex items-center justify-end gap-1.5">
									<button
										type="button"
										onClick={() => onViewTrip(item)}
										title="Xem chi tiết chuyến đi"
										aria-label={`Xem chi tiết chuyến đi ${item.tripTitle}`}
										className="rounded-lg border border-[#dfe8df] p-1.5 text-[#164027] hover:bg-[#eef7f0] transition"
									>
										<Eye className="size-4" />
									</button>
									{item.isEligible && !item.isSettled && (
										<button
											type="button"
											disabled={isSettling}
											onClick={() => onSettle(item.tripId)}
											className="rounded-lg bg-[#164027] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#11321f] transition disabled:opacity-50"
										>
											Quyết toán ngay
										</button>
									)}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
