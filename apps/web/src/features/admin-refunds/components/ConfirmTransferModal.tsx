import { useEffect, useRef, useState } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminRefundItem } from "../types";

export interface ConfirmTransferModalProps {
	refund: AdminRefundItem | null;
	open: boolean;
	isSubmitting: boolean;
	onClose: () => void;
	onConfirm: (obligationId: string, transactionRef: string, note?: string) => Promise<void>;
}

export function ConfirmTransferModal({
	refund,
	open,
	isSubmitting,
	onClose,
	onConfirm,
}: ConfirmTransferModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [transactionRef, setTransactionRef] = useState("");
	const [note, setNote] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		const el = dialogRef.current;
		if (open) {
			setTransactionRef("");
			setNote("");
			setErrorMessage("");
			el?.showModal();
		} else {
			el?.close();
		}
		return () => el?.close();
	}, [open]);

	if (!refund) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!transactionRef.trim()) {
			setErrorMessage("Vui lòng nhập mã giao dịch chuyển khoản / mã bill ngân hàng.");
			return;
		}
		try {
			await onConfirm(refund.id, transactionRef.trim(), note.trim() || undefined);
			onClose();
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Có lỗi xảy ra khi xác nhận.");
		}
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="confirm-transfer-modal-title"
			onCancel={(e) => {
				e.preventDefault();
				if (!isSubmitting) onClose();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-[#cbd9ce] bg-white p-6 text-[#10221b] shadow-xl backdrop:bg-black/50"
		>
			<h2 id="confirm-transfer-modal-title" className="text-xl font-extrabold text-[#10221b]">
				Xác nhận chuyển tiền thủ công
			</h2>

			{errorMessage && (
				<div
					role="alert"
					className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
				>
					{errorMessage}
				</div>
			)}

			<div className="mt-4 space-y-2 rounded-2xl bg-[#f4f7f2] p-4 text-xs">
				<div className="flex justify-between">
					<span className="text-[#667a6d]">Khách hàng:</span>
					<strong className="text-[#10221b]">{refund.camper.fullName}</strong>
				</div>
				<div className="flex justify-between">
					<span className="text-[#667a6d]">Số tiền hoàn:</span>
					<strong className="text-[#164027] font-bold text-sm">
						{formatBookingMoney(refund.amount)}
					</strong>
				</div>
				{refund.beneficiary?.bankName && (
					<div className="flex justify-between">
						<span className="text-[#667a6d]">Ngân hàng:</span>
						<strong className="text-[#10221b]">{refund.beneficiary.bankName}</strong>
					</div>
				)}
				{refund.beneficiary?.accountNumber && (
					<div className="flex justify-between">
						<span className="text-[#667a6d]">Số tài khoản:</span>
						<strong className="text-[#10221b]">{refund.beneficiary.accountNumber}</strong>
					</div>
				)}
				{refund.beneficiary?.accountHolderName && (
					<div className="flex justify-between">
						<span className="text-[#667a6d]">Chủ tài khoản:</span>
						<strong className="text-[#10221b] uppercase">
							{refund.beneficiary.accountHolderName}
						</strong>
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} className="mt-4 space-y-4">
				<div>
					<label htmlFor="transaction-ref-input" className="block text-xs font-bold text-[#10221b]">
						Mã giao dịch / Mã bill chuyển khoản ngân hàng <span className="text-rose-600">*</span>
					</label>
					<input
						id="transaction-ref-input"
						type="text"
						disabled={isSubmitting}
						value={transactionRef}
						onChange={(e) => setTransactionRef(e.target.value)}
						placeholder="Ví dụ: FT24091002345678 hoặc MB123456"
						className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
				</div>

				<div>
					<label htmlFor="confirm-note-input" className="block text-xs font-bold text-[#10221b]">
						Ghi chú đối soát (tùy chọn)
					</label>
					<input
						id="confirm-note-input"
						type="text"
						disabled={isSubmitting}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Ví dụ: Đã chuyển khoản qua app VCB lúc 15:30"
						className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
				</div>

				<div className="mt-6 flex justify-end gap-3 pt-2">
					<button
						type="button"
						disabled={isSubmitting}
						onClick={onClose}
						className="rounded-xl border border-[#cbd9ce] px-4 py-2 text-sm font-semibold text-[#10221b] hover:bg-gray-50 disabled:opacity-50"
					>
						Hủy bỏ
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-xl bg-[#164027] px-5 py-2 text-sm font-bold text-white hover:bg-[#123320] disabled:opacity-50"
					>
						{isSubmitting ? "Đang xác nhận..." : "Xác nhận đã chuyển tiền"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
