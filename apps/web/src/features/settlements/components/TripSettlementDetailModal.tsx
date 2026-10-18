import { AlertTriangle, CheckCircle2, Clock, Landmark, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import { useTripDetail } from "../../trips/hooks/useTripDetail";
import { TRIP_STATUS_LABELS } from "../../trips/types";
import type { TripSettlementEvaluation } from "../types";

export interface TripSettlementDetailModalProps {
	item: TripSettlementEvaluation | null;
	isOpen: boolean;
	onClose: () => void;
	onSettle?: (tripId: string) => Promise<void>;
	isSettling?: boolean;
}

export function TripSettlementDetailModal({
	item,
	isOpen,
	onClose,
	onSettle,
	isSettling = false,
}: TripSettlementDetailModalProps) {
	const { trip, isLoading } = useTripDetail(isOpen && item ? item.tripId : undefined);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen || !item) return null;

	const handleSettleClick = async () => {
		if (!onSettle) return;
		await onSettle(item.tripId);
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/50 p-4 backdrop-blur-xs"
			data-testid="trip-settlement-detail-modal"
		>
			{/* biome-ignore lint/a11y/useSemanticElements: overlay-rendered modal shell */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="trip-detail-modal-title"
				className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-[#dfe8df]"
			>
				{/* Modal Header */}
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-5 py-3.5">
					<div>
						<h2 id="trip-detail-modal-title" className="text-base font-extrabold text-[#10221b]">
							Chi tiết chuyến đi
						</h2>
						<p className="text-xs text-[#667a6d]">
							#{item.tripId.slice(0, 8)} • {item.tripTitle}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng"
						className="rounded-lg p-1.5 text-[#667a6d] hover:bg-[#f4f7f2] hover:text-[#10221b] transition"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Modal Body */}
				<div className="overflow-y-auto p-5 space-y-4">
					{isLoading && (
						<div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-[#54655a]">
							<Loader2 className="size-4 animate-spin text-[#164027]" />
							<span>Đang tải thêm chi tiết chuyến đi...</span>
						</div>
					)}

					{/* Trip General Info Grid */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Host phụ trách</span>
							<span className="font-bold text-[#10221b] truncate block">{item.hostName}</span>
							<span className="text-[10px] text-[#7d8d83] font-mono">
								#{item.hostId.slice(0, 8)}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Trạng thái</span>
							<span className="font-bold text-[#10221b] block">
								{trip ? (TRIP_STATUS_LABELS[trip.status] ?? trip.status) : item.tripStatus}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Loại chuyến</span>
							<span className="font-bold text-[#10221b] block">
								{trip
									? trip.tripType === "day_trip"
										? "Trong ngày"
										: `Qua đêm (${trip.durationNights} đêm)`
									: "—"}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Khởi hành</span>
							<span className="font-bold text-[#10221b] block">
								{trip?.startsAt ? formatBookingDateTime(trip.startsAt) : "—"}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Kết thúc</span>
							<span className="font-bold text-[#10221b] block">
								{trip?.endsAt ? formatBookingDateTime(trip.endsAt) : "—"}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Khách tham gia</span>
							<span className="font-bold text-[#10221b] block">
								{trip ? `${trip.seatsTaken} / ${trip.capacityMax ?? trip.capacityMin} khách` : "—"}
							</span>
						</div>
					</div>

					{/* Trip Description */}
					{trip?.description && (
						<div className="rounded-xl bg-[#f8faf7] p-3 border border-[#e8efe7] text-xs">
							<span className="font-bold text-[#10221b] block mb-1">Mô tả</span>
							<p className="text-[#425048] leading-relaxed">{trip.description}</p>
						</div>
					)}

					{/* Waypoints list */}
					{trip?.waypoints && trip.waypoints.length > 0 && (
						<div className="rounded-xl border border-[#e8efe7] p-3 text-xs">
							<h3 className="font-bold text-[#10221b] mb-2">
								Điểm dừng lịch trình ({trip.waypoints.length})
							</h3>
							<div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
								{trip.waypoints.map((wp, idx) => (
									<div
										key={wp.id || String(idx)}
										className="flex items-center justify-between py-1 border-b border-[#f1f5f0] last:border-b-0 text-[11px]"
									>
										<span className="font-medium text-[#10221b]">
											{idx + 1}. {wp.name}
										</span>
										<span className="text-[#7d8d83]">
											{wp.plannedAt ? formatBookingDateTime(wp.plannedAt) : "—"}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Blocking reasons banner if any */}
					{item.isBlocked && (
						<div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
							<div className="flex items-center gap-1.5 font-bold">
								<AlertTriangle className="size-4 text-rose-600" />
								<span>Chuyến đi đang bị chặn quyết toán:</span>
							</div>
							<ul className="list-disc list-inside mt-1.5 space-y-0.5 text-rose-700 text-[11px]">
								{item.blockingReasons.map((reason, i) => (
									<li key={String(i)}>{reason}</li>
								))}
							</ul>
						</div>
					)}

					{/* Settlement Breakdown Card */}
					<div className="rounded-xl border border-[#e8efe7] p-3 text-xs space-y-2">
						<h3 className="font-bold text-[#10221b]">Đối soát tài chính</h3>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="flex justify-between border-b border-[#f1f5f0] py-1">
								<span className="text-[#667a6d]">Doanh thu Base:</span>
								<span className="font-semibold text-[#10221b]">
									{formatBookingMoney(item.settlementBase)}
								</span>
							</div>
							<div className="flex justify-between border-b border-[#f1f5f0] py-1">
								<span className="text-[#667a6d]">Phí sàn (5%):</span>
								<span className="font-semibold text-amber-800">
									{formatBookingMoney(item.platformFee)}
								</span>
							</div>
						</div>

						{/* Settlement Status Note */}
						<div className="pt-1 flex items-center gap-2">
							<span className="text-[#667a6d]">Trạng thái đối soát:</span>
							{item.isSettled ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
									<CheckCircle2 className="size-3" />
									Đã quyết toán {item.settledAt ? `(${formatBookingDateTime(item.settledAt)})` : ""}
								</span>
							) : item.isBlocked ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
									<AlertTriangle className="size-3" />
									Bị chặn khiếu nại
								</span>
							) : item.isEligible ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
									<Landmark className="size-3" />
									Đủ điều kiện quyết toán
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
									<Clock className="size-3" />
									Giữ tiền bảo đảm ({item.hoursSinceCompleted ?? 0}/72h)
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Modal Footer / Action Bar (Single Total Display) */}
				<div className="flex items-center justify-between border-t border-[#e0ebe0] bg-[#f8faf7] px-5 py-3 rounded-b-2xl">
					<div className="flex items-center gap-2 text-xs">
						<span className="text-[#667a6d]">Thực nhận ví Host (95%):</span>
						<strong className="text-sm font-black text-[#164027]">
							{formatBookingMoney(item.hostNetAmount)}
						</strong>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-xl border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#55685a] hover:bg-[#f1f5f0] transition"
						>
							Đóng
						</button>

						{item.isEligible && !item.isSettled && onSettle && (
							<button
								type="button"
								disabled={isSettling}
								onClick={handleSettleClick}
								className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#11321f] transition disabled:opacity-50"
							>
								{isSettling ? "Đang quyết toán..." : "Quyết toán ngay"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
