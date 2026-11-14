import { CheckCircle2, Clock, FileText, Loader2, Scale } from "lucide-react";
import { useState } from "react";
import { Button, Modal } from "../../../shared/components";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import { ADJUSTMENT_TYPE_LABELS } from "../constants";
import type { FinancialAdjustmentItem } from "../types";

export interface AdjustmentDetailModalProps {
	adjustment: FinancialAdjustmentItem | null;
	isOpen: boolean;
	isResolving: boolean;
	onClose: () => void;
	onResolve: (id: string, notes?: string) => Promise<void>;
}

export function AdjustmentDetailModal({
	adjustment,
	isOpen,
	isResolving,
	onClose,
	onResolve,
}: AdjustmentDetailModalProps) {
	const [resolveNotes, setResolveNotes] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (!adjustment) return null;

	const handleResolve = async () => {
		setError(null);
		try {
			await onResolve(adjustment.id, resolveNotes.trim() || undefined);
			setResolveNotes("");
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Không thể ghi nhận kết quả xử lý khoản hoàn.");
		}
	};

	const isPending = adjustment.status === "pending";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Chi tiết khoản hoàn sau quyết toán"
			icon={<Scale className="size-5" />}
			size="lg"
			isCloseDisabled={isResolving}
		>
			<div className="space-y-4">
				{adjustment.refundPaymentId && (
					<p className="text-sm text-[#667a6d]">
						{adjustment.refundStatus === "succeeded"
							? "Đã xác nhận chuyển tiền hoàn cho khách."
							: "Yêu cầu đã được duyệt, chưa xác nhận chuyển tiền cho khách. Xác nhận sau khi chuyển khoản tại tab Hoàn tiền Camper."}
					</p>
				)}
				{error && (
					<div
						role="alert"
						className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"
					>
						{error}
					</div>
				)}

				{/* Key Metric Card */}
				<div className="rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-wider text-[#667a6d]">
								{ADJUSTMENT_TYPE_LABELS[adjustment.type] || adjustment.type}
							</p>
							<p className="mt-1 text-2xl font-black text-[#164027]">
								{formatBookingMoney(adjustment.amount)}
							</p>
						</div>
						<div>
							{adjustment.status === "resolved" ? (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
									<CheckCircle2 className="size-3.5" />
									Đã xử lý
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
									<Clock className="size-3.5" />
									Chờ xử lý
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Traceability Grid */}
				<div className="rounded-2xl border border-[#dfe8df] p-4 space-y-3 bg-white">
					<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wide">
						Thông tin giao dịch gốc
					</h4>
					<dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
						<div>
							<dt className="text-[11px] text-[#667a6d]">Chuyến đi:</dt>
							<dd className="font-semibold text-[#10221b]">{adjustment.tripTitle}</dd>
						</div>
						<div>
							<dt className="text-[11px] text-[#667a6d]">Người tổ chức:</dt>
							<dd className="font-semibold text-[#10221b]">{adjustment.hostName}</dd>
						</div>
						<div>
							<dt className="text-[11px] text-[#667a6d]">Khách đặt chỗ:</dt>
							<dd className="font-semibold text-[#10221b]">{adjustment.camperName}</dd>
						</div>
						<div>
							<dt className="text-[11px] text-[#667a6d]">Ngày đặt chỗ:</dt>
							<dd className="text-[#10221b]">
								{formatBookingDateTime(adjustment.bookingCreatedAt)}
							</dd>
						</div>
						<div>
							<dt className="text-[11px] text-[#667a6d]">Ngày quyết toán:</dt>
							<dd className="text-[#10221b]">{formatBookingDateTime(adjustment.settledAt)}</dd>
						</div>
						{adjustment.payoutId && (
							<div>
								<dt className="text-[11px] text-[#667a6d]">Ngày yêu cầu rút tiền:</dt>
								<dd className="text-[#10221b]">
									{formatBookingDateTime(adjustment.payoutRequestedAt)}
								</dd>
							</div>
						)}
					</dl>
				</div>

				{/* Reason and Notes */}
				<div className="rounded-2xl border border-[#dfe8df] p-4 space-y-2 bg-white text-xs">
					<h4 className="font-bold text-[#10221b] uppercase tracking-wide text-[11px]">
						Lý do hoàn tiền
					</h4>
					<p className="text-[#3b4941] leading-relaxed bg-[#f6f9f6] p-3 rounded-xl border border-[#e4ece4]">
						{adjustment.reason}
					</p>

					{adjustment.notes && (
						<div className="pt-2">
							<h4 className="font-bold text-[#10221b] uppercase tracking-wide text-[11px]">
								Ghi chú nội bộ
							</h4>
							<p className="mt-1 text-[#52665b] whitespace-pre-line text-xs bg-[#f6f9f6] p-3 rounded-xl border border-[#e4ece4]">
								{adjustment.notes}
							</p>
						</div>
					)}
				</div>

				{/* Resolution Section if Pending */}
				{isPending && (
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
						<div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
							<FileText className="size-4 text-emerald-700" />
							<span>Ghi nhận kết quả xử lý khoản hoàn hoặc thu hồi</span>
						</div>
						<textarea
							rows={2}
							value={resolveNotes}
							onChange={(e) => setResolveNotes(e.target.value)}
							placeholder="Ghi chú xác nhận thu hồi (ví dụ: Đã nhận tiền chuyển khoản bồi hoàn từ Host qua ngân hàng)..."
							className="w-full rounded-xl border border-emerald-200 bg-white p-2.5 text-xs outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
							disabled={isResolving}
						/>
					</div>
				)}

				{/* Action Footer */}
				<div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e0ebe0]">
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={isResolving}
						className="text-xs font-bold"
					>
						Đóng
					</Button>
					{isPending && (
						<Button
							type="button"
							onClick={handleResolve}
							disabled={isResolving}
							className="bg-[#164027] text-white hover:bg-[#11321f] text-xs font-bold"
						>
							{isResolving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
							<span>Đánh dấu đã xử lý</span>
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
}
