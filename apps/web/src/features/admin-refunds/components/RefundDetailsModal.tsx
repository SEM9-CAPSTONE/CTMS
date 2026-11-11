import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	formatBookingDateTime,
	formatBookingMoney,
} from "../../booking-details/utils/booking-details-formatters";
import { RefundStateBadge } from "../../booking-refund/components/RefundStateBadge";
import type { AdminRefundItem } from "../types";

export interface RefundDetailsModalProps {
	refund: AdminRefundItem | null;
	open: boolean;
	onClose: () => void;
	onOpenConfirm?: (refund: AdminRefundItem) => void;
	onOpenReject?: (refund: AdminRefundItem) => void;
}

export function RefundDetailsModal({
	refund,
	open,
	onClose,
	onOpenConfirm,
	onOpenReject,
}: RefundDetailsModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [copiedField, setCopiedField] = useState<string | null>(null);

	useEffect(() => {
		const el = dialogRef.current;
		if (open) {
			setCopiedField(null);
			if (typeof el?.showModal === "function") {
				el.showModal();
			}
		} else {
			if (typeof el?.close === "function") {
				el.close();
			}
		}
		return () => {
			if (typeof el?.close === "function") {
				el.close();
			}
		};
	}, [open]);

	if (!refund) return null;

	const handleCopy = async (text: string, fieldName: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(fieldName);
			setTimeout(() => setCopiedField(null), 2000);
		} catch {
			// ignore copy error
		}
	};

	const isPending = refund.status === "pending";

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="refund-details-modal-title"
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-3xl border border-[#cbd9ce] bg-white p-6 text-[#10221b] shadow-xl backdrop:bg-black/50"
		>
			<div className="flex items-center justify-between border-b border-[#e7eee7] pb-3">
				<h2 id="refund-details-modal-title" className="text-xl font-extrabold text-[#10221b]">
					Chi tiết yêu cầu hoàn tiền
				</h2>
				<button
					type="button"
					aria-label="Đóng chi tiết"
					onClick={onClose}
					className="rounded-full p-1.5 text-[#667a6d] hover:bg-[#f4f7f2] hover:text-[#10221b] transition"
				>
					<X className="size-5" />
				</button>
			</div>

			<div className="mt-4 max-h-[70vh] overflow-y-auto space-y-4 pr-1 text-sm">
				{/* Overview Bar */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f4f7f2] p-4">
					<div>
						<p className="text-xs text-[#667a6d]">Mã yêu cầu hoàn tiền</p>
						<p className="font-mono text-sm font-bold text-[#10221b]">#{refund.id}</p>
					</div>
					<div className="text-right">
						<p className="text-xs text-[#667a6d]">Số tiền hoàn</p>
						<p className="text-lg font-black text-[#164027]">{formatBookingMoney(refund.amount)}</p>
					</div>
					<div>
						<RefundStateBadge status={refund.status} />
					</div>
				</div>

				{/* Booking & Trip Info */}
				<div className="rounded-2xl border border-[#e8efe7] p-4">
					<h3 className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
						Chuyến đi & Đơn đặt chỗ
					</h3>
					<div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
						<div>
							<span className="text-[#667a6d]">Tên chuyến đi:</span>
							<p className="font-semibold text-[#10221b]">{refund.tripTitle || "—"}</p>
						</div>
						<div>
							<span className="text-[#667a6d]">Mã đơn đặt (Booking ID):</span>
							<p className="font-mono font-medium text-[#10221b]">#{refund.bookingId}</p>
						</div>
					</div>
				</div>

				{/* Camper Info */}
				<div className="rounded-2xl border border-[#e8efe7] p-4">
					<h3 className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
						Thông tin khách hàng
					</h3>
					<div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
						<div>
							<span className="text-[#667a6d]">Họ và tên:</span>
							<p className="font-semibold text-[#10221b]">{refund.camper.fullName}</p>
						</div>
						<div>
							<span className="text-[#667a6d]">Email:</span>
							<p className="text-[#10221b]">{refund.camper.email || "—"}</p>
						</div>
						<div>
							<span className="text-[#667a6d]">Số điện thoại:</span>
							<p className="text-[#10221b]">{refund.camper.phone || "—"}</p>
						</div>
					</div>
				</div>

				{/* Beneficiary Info */}
				<div className="rounded-2xl border border-[#e8efe7] p-4">
					<h3 className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
						Tài khoản nhận tiền
					</h3>
					{refund.beneficiary?.bankName ? (
						<div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
							<div>
								<span className="text-[#667a6d]">Ngân hàng:</span>
								<p className="font-bold text-[#10221b]">{refund.beneficiary.bankName}</p>
							</div>
							<div>
								<span className="text-[#667a6d]">Số tài khoản:</span>
								<div className="flex items-center gap-1.5">
									<p className="font-mono font-bold text-[#164027]">
										{refund.beneficiary.accountNumber}
									</p>
									{refund.beneficiary.accountNumber && (
										<button
											type="button"
											onClick={() =>
												handleCopy(refund.beneficiary?.accountNumber ?? "", "accountNumber")
											}
											aria-label="Sao chép số tài khoản"
											className="rounded p-1 text-[#667a6d] hover:bg-[#eef7f0] hover:text-[#164027]"
										>
											{copiedField === "accountNumber" ? (
												<Check className="size-3.5 text-emerald-600" />
											) : (
												<Copy className="size-3.5" />
											)}
										</button>
									)}
								</div>
							</div>
							<div>
								<span className="text-[#667a6d]">Chủ tài khoản:</span>
								<p className="font-bold uppercase text-[#10221b]">
									{refund.beneficiary.accountHolderName}
								</p>
							</div>
						</div>
					) : (
						<p className="mt-2 text-xs text-gray-400 italic">
							Chưa có thông tin tài khoản ngân hàng
						</p>
					)}
				</div>

				{/* Refund Reason */}
				<div className="rounded-2xl border border-[#e8efe7] p-4">
					<h3 className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
						Lý do yêu cầu hoàn tiền
					</h3>
					<p className="mt-2 text-xs text-[#10221b] whitespace-pre-wrap">
						{refund.reason || "Không có lý do được ghi nhận"}
					</p>
				</div>

				{/* Audit / Reconciliation */}
				{(refund.providerReference || refund.note || refund.rejectionReason) && (
					<div className="rounded-2xl border border-[#e8efe7] p-4 space-y-2 text-xs">
						<h3 className="text-xs font-bold uppercase tracking-wider text-[#667a6d]">
							Thông tin đối soát & Xử lý
						</h3>
						{refund.providerReference && (
							<div>
								<span className="text-[#667a6d]">Mã GD ngân hàng: </span>
								<strong className="font-mono text-emerald-900">{refund.providerReference}</strong>
							</div>
						)}
						{refund.note && (
							<div>
								<span className="text-[#667a6d]">Ghi chú: </span>
								<span className="text-[#52665b]">{refund.note}</span>
							</div>
						)}
						{refund.rejectionReason && (
							<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
								<span className="font-bold">Lý do từ chối: </span>
								<span>{refund.rejectionReason}</span>
							</div>
						)}
					</div>
				)}

				{/* Timestamps */}
				<div className="flex justify-between border-t border-[#e8efe7] pt-3 text-[11px] text-[#7d8d83]">
					<span>Tạo lúc: {formatBookingDateTime(refund.createdAt)}</span>
					<span>Cập nhật: {formatBookingDateTime(refund.updatedAt)}</span>
				</div>
			</div>

			{/* Actions Footer */}
			<div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#e7eee7] pt-4">
				<button
					type="button"
					onClick={onClose}
					className="rounded-xl border border-[#cbd9ce] px-4 py-2 text-sm font-semibold text-[#10221b] hover:bg-gray-50 transition"
				>
					Đóng
				</button>
				{isPending && onOpenReject && (
					<button
						type="button"
						onClick={() => onOpenReject(refund)}
						className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 transition"
					>
						Từ chối
					</button>
				)}
				{isPending && onOpenConfirm && (
					<button
						type="button"
						onClick={() => onOpenConfirm(refund)}
						className="rounded-xl bg-[#164027] px-5 py-2 text-sm font-bold text-white hover:bg-[#123320] transition"
					>
						Xác nhận chuyển tiền
					</button>
				)}
			</div>
		</dialog>
	);
}
