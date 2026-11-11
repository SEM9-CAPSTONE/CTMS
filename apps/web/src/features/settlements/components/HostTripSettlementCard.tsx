import { AlertTriangle, CheckCircle2, Clock, Landmark, Loader2 } from "lucide-react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { useTripSettlementEvaluation } from "../hooks/useSettlements";

interface HostTripSettlementCardProps {
	tripId: string;
	onOpenWallet?: () => void;
}

export function HostTripSettlementCard({ tripId, onOpenWallet }: HostTripSettlementCardProps) {
	const { data: evalData, isLoading, error } = useTripSettlementEvaluation(tripId);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 rounded-2xl border border-[#dfe8df] bg-white p-4 text-xs font-semibold text-[#52665b]">
				<Loader2 className="size-4 animate-spin text-[#164027]" />
				<span>Đang tải thông tin quyết toán chuyến đi...</span>
			</div>
		);
	}

	if (error || !evalData) {
		return null;
	}

	return (
		<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex items-center justify-between border-b border-[#e7eee7] pb-3">
				<div className="flex items-center gap-2.5">
					<Landmark className="size-5 text-[#164027]" />
					<h3 className="text-base font-extrabold text-[#10221b]">
						Quyết toán doanh thu chuyến đi
					</h3>
				</div>
				{evalData.isSettled ? (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
						<CheckCircle2 className="size-3.5" />
						Đã quyết toán
					</span>
				) : evalData.isBlocked ? (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
						<AlertTriangle className="size-3.5" />
						Tạm giữ do khiếu nại
					</span>
				) : (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
						<Clock className="size-3.5" />
						Đang giữ tiền (72h)
					</span>
				)}
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-2xl border border-[#edf3ed] bg-[#f9fbf9] p-4">
					<p className="text-xs font-bold text-[#667a6d]">Doanh thu chuyến đi (Base)</p>
					<p className="mt-1 text-lg font-black text-[#10221b]">
						{formatBookingMoney(evalData.settlementBase)}
					</p>
					<p className="mt-0.5 text-[11px] text-[#7d8d83]">Đã trừ các khoản hoàn tiền thành công</p>
				</div>

				<div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
					<p className="text-xs font-bold text-amber-900">Phí nền tảng CTMS (5%)</p>
					<p className="mt-1 text-lg font-black text-amber-900">
						-{formatBookingMoney(evalData.platformFee)}
					</p>
					<p className="mt-0.5 text-[11px] text-amber-800">Tỷ lệ hoa hồng cố định 5%</p>
				</div>

				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
					<p className="text-xs font-bold text-emerald-900">Thực nhận ví Host (95%)</p>
					<p className="mt-1 text-lg font-black text-[#164027]">
						+{formatBookingMoney(evalData.hostNetAmount)}
					</p>
					<p className="mt-0.5 text-[11px] text-emerald-800">
						{evalData.isSettled ? "Đã ghi có vào Ví Host" : "Sẽ cộng vào Ví Host khi đủ điều kiện"}
					</p>
				</div>
			</div>

			{!evalData.isSettled && (
				<div className="mt-4 rounded-2xl border border-[#edf3ed] bg-[#f6f9f6] p-4 text-xs text-[#52665b]">
					<div className="flex items-start gap-2">
						<Clock className="size-4 shrink-0 text-[#164027] mt-0.5" />
						<div>
							<p className="font-bold text-[#10221b]">Điều kiện quyết toán tự động:</p>
							<ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px]">
								<li>Chuyến đi đã hoàn thành và kết thúc.</li>
								<li>
									Thời gian hoàn thành đã qua ít nhất 72 giờ ({evalData.hoursSinceCompleted ?? 0}h
									đã trôi qua).
								</li>
								<li>
									Hết thời hạn 24 giờ khiếu nại của Camper và không còn khiếu nại nào đang mở.
								</li>
							</ul>
						</div>
					</div>
					{evalData.blockingReasons.length > 0 && (
						<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
							<p className="font-bold">Lý do đang giữ tiền:</p>
							<p className="mt-0.5 text-[11px]">{evalData.blockingReasons.join("; ")}</p>
						</div>
					)}
				</div>
			)}

			<div className="mt-4 flex items-center justify-between pt-2">
				<p className="text-xs text-[#667a6d]">Quản lý doanh thu và rút tiền tại trang Ví Host.</p>
				{onOpenWallet && (
					<button
						type="button"
						onClick={onOpenWallet}
						className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#11321f]"
					>
						Đến Ví Host & Rút tiền
					</button>
				)}
			</div>
		</div>
	);
}
