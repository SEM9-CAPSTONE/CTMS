import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminRefundItem } from "../types";

export interface RejectRefundModalProps {
	refund: AdminRefundItem | null;
	open: boolean;
	isSubmitting: boolean;
	onClose: () => void;
	onReject: (obligationId: string, rejectionReason: string) => Promise<void>;
}

export function RejectRefundModal({
	refund,
	open,
	isSubmitting,
	onClose,
	onReject,
}: RejectRefundModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [reason, setReason] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		const el = dialogRef.current;
		if (open) {
			setReason("");
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
		if (!reason.trim()) {
			setErrorMessage("Vui lòng nhập lý do từ chối yêu cầu hoàn tiền.");
			return;
		}
		try {
			await onReject(refund.id, reason.trim());
			onClose();
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Có lỗi xảy ra khi từ chối yêu cầu.");
		}
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="reject-refund-modal-title"
			onCancel={(e) => {
				e.preventDefault();
				if (!isSubmitting) onClose();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-[#cbd9ce] bg-white p-6 text-[#10221b] shadow-xl backdrop:bg-black/50"
		>
			<div className="flex items-center justify-between gap-3 border-b border-[#e7eee7] pb-3">
				<h2 id="reject-refund-modal-title" className="text-xl font-extrabold text-rose-700">
					Từ chối yêu cầu hoàn tiền
				</h2>
				<button
					type="button"
					aria-label="Đóng"
					disabled={isSubmitting}
					onClick={onClose}
					className="rounded-full p-1.5 text-[#667a6d] hover:bg-[#f4f7f2] hover:text-[#10221b] transition disabled:opacity-50"
				>
					<X className="size-5" />
				</button>
			</div>

			{errorMessage && (
				<div
					role="alert"
					className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
				>
					{errorMessage}
				</div>
			)}

			<div className="mt-4 space-y-2 rounded-2xl bg-rose-50/50 p-4 text-xs">
				<div className="flex justify-between">
					<span className="text-[#667a6d]">Khách hàng:</span>
					<strong className="text-[#10221b]">{refund.camper.fullName}</strong>
				</div>
				<div className="flex justify-between">
					<span className="text-[#667a6d]">Số tiền hoàn:</span>
					<strong className="text-rose-700 font-bold">{formatBookingMoney(refund.amount)}</strong>
				</div>
				{refund.reason && (
					<div className="flex justify-between">
						<span className="text-[#667a6d]">Lý do khách hàng yêu cầu:</span>
						<span className="text-[#10221b] max-w-[250px] text-right truncate">
							{refund.reason}
						</span>
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} className="mt-4 space-y-4">
				<div>
					<label
						htmlFor="rejection-reason-input"
						className="block text-xs font-bold text-[#10221b]"
					>
						Lý do từ chối hoàn tiền <span className="text-rose-600">*</span>
					</label>
					<textarea
						id="rejection-reason-input"
						rows={3}
						disabled={isSubmitting}
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Giải thích lý do không đủ điều kiện hoặc thông tin không chính xác..."
						className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm focus:border-rose-600 focus:outline-none disabled:bg-gray-100"
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
						className="rounded-xl bg-rose-700 px-5 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50"
					>
						{isSubmitting ? "Đang xử lý..." : "Xác nhận từ chối"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
