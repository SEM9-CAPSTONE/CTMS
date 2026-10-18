import { CheckCircle2, Clock, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminPayoutItem } from "../types";

export interface AdminPayoutDetailModalProps {
	payout: AdminPayoutItem | null;
	isOpen: boolean;
	onClose: () => void;
	onOpenConfirm?: (payout: AdminPayoutItem) => void;
	onOpenReject?: (payout: AdminPayoutItem) => void;
}

export function AdminPayoutDetailModal({
	payout,
	isOpen,
	onClose,
	onOpenConfirm,
	onOpenReject,
}: AdminPayoutDetailModalProps) {
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen || !payout) return null;

	const handleConfirmClick = () => {
		onClose();
		onOpenConfirm?.(payout);
	};

	const handleRejectClick = () => {
		onClose();
		onOpenReject?.(payout);
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/50 p-4 backdrop-blur-xs"
			data-testid="admin-payout-detail-modal"
		>
			{/* biome-ignore lint/a11y/useSemanticElements: overlay-rendered modal shell */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="payout-detail-modal-title"
				className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl border border-[#dfe8df]"
			>
				{/* Modal Header */}
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-5 py-3.5">
					<div>
						<h2 id="payout-detail-modal-title" className="text-base font-extrabold text-[#10221b]">
							Chi tiết yêu cầu rút tiền
						</h2>
						<p className="text-xs text-[#667a6d]">
							#{payout.id.slice(0, 8)} • Host: {payout.hostName}
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
					{/* Host & Request General Info */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Host yêu cầu</span>
							<span className="font-bold text-[#10221b] truncate block">{payout.hostName}</span>
							<span className="text-[10px] text-[#7d8d83] font-mono">
								#{payout.hostId.slice(0, 8)}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Liên hệ</span>
							<span className="font-bold text-[#10221b] truncate block">
								{payout.hostEmail || payout.hostPhone || "—"}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Trạng thái</span>
							<div className="pt-0.5">
								{payout.status === "succeeded" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
										<CheckCircle2 className="size-3" />
										Đã chuyển tiền
									</span>
								) : payout.status === "failed" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
										<XCircle className="size-3" />
										Đã từ chối
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
										<Clock className="size-3" />
										Chờ chuyển tiền
									</span>
								)}
							</div>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Thời gian tạo</span>
							<span className="font-bold text-[#10221b] block">
								{new Date(payout.createdAt).toLocaleString("vi-VN")}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Cập nhật lúc</span>
							<span className="font-bold text-[#10221b] block">
								{new Date(payout.updatedAt).toLocaleString("vi-VN")}
							</span>
						</div>

						<div className="rounded-xl bg-[#f8faf7] p-2.5 border border-[#e8efe7]">
							<span className="text-[#667a6d] text-[11px] block">Mã ví Host</span>
							<span className="font-bold text-[#10221b] font-mono block">
								#{payout.walletId.slice(0, 8)}
							</span>
						</div>
					</div>

					{/* Bank Account Info */}
					<div className="rounded-xl border border-[#e8efe7] p-3 text-xs space-y-2">
						<h3 className="font-bold text-[#10221b]">Thông tin tài khoản thụ hưởng</h3>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="flex justify-between border-b border-[#f1f5f0] py-1">
								<span className="text-[#667a6d]">Ngân hàng:</span>
								<span className="font-bold text-[#10221b]">{payout.bankName}</span>
							</div>
							<div className="flex justify-between border-b border-[#f1f5f0] py-1">
								<span className="text-[#667a6d]">Số tài khoản:</span>
								<span className="font-mono font-bold text-[#10221b]">{payout.accountNumber}</span>
							</div>
						</div>
						<div className="flex justify-between py-1">
							<span className="text-[#667a6d]">Chủ tài khoản:</span>
							<span className="font-bold uppercase text-[#10221b]">{payout.accountHolderName}</span>
						</div>
					</div>

					{/* Audit / Settlement Details: Mã giao dịch, Lý do từ chối, Ghi chú */}
					<div className="rounded-xl border border-[#e8efe7] p-3 text-xs space-y-2.5">
						<h3 className="font-bold text-[#10221b]">Thông tin đối soát & Xử lý giao dịch</h3>

						{payout.transactionRef ? (
							<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs">
								<span className="text-emerald-800 font-bold block mb-0.5">
									Mã giao dịch ngân hàng (FT / Ref No.):
								</span>
								<span className="font-mono font-bold text-emerald-950 text-sm">
									{payout.transactionRef}
								</span>
							</div>
						) : null}

						{payout.rejectionReason ? (
							<div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
								<span className="font-bold block mb-0.5">Lý do từ chối yêu cầu:</span>
								<p className="text-rose-900">{payout.rejectionReason}</p>
							</div>
						) : null}

						{payout.adminNotes ? (
							<div className="rounded-xl bg-[#f8faf7] border border-[#e8efe7] p-2.5 text-xs">
								<span className="text-[#667a6d] font-bold block mb-0.5">Ghi chú nội bộ:</span>
								<p className="text-[#425048] italic">{payout.adminNotes}</p>
							</div>
						) : null}

						{!payout.transactionRef && !payout.rejectionReason && !payout.adminNotes && (
							<p className="text-[#7d8d83] italic">
								{payout.status === "pending"
									? "Chưa có thông tin đối soát. Yêu cầu đang chờ quản trị viên xử lý."
									: "Không có ghi chú thêm."}
							</p>
						)}
					</div>
				</div>

				{/* Modal Footer / Action Bar (Single Total Display) */}
				<div className="flex items-center justify-between border-t border-[#e0ebe0] bg-[#f8faf7] px-5 py-3 rounded-b-2xl">
					<div className="flex items-center gap-2 text-xs">
						<span className="text-[#667a6d]">Số tiền yêu cầu rút:</span>
						<strong className="text-sm font-black text-[#164027]">
							{formatBookingMoney(payout.amount)}
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

						{payout.status === "pending" && (
							<>
								{onOpenReject && (
									<button
										type="button"
										onClick={handleRejectClick}
										className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
									>
										Từ chối
									</button>
								)}
								{onOpenConfirm && (
									<button
										type="button"
										onClick={handleConfirmClick}
										className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#11321f] transition"
									>
										Xác nhận chuyển
									</button>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
