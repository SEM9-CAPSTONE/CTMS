import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminPayoutItem } from "../types";

export interface RejectPayoutModalProps {
	payout: AdminPayoutItem | null;
	isSubmitting: boolean;
	onClose: () => void;
	onReject: (payoutId: string, rejectionReason: string) => Promise<void>;
}

export function RejectPayoutModal({
	payout,
	isSubmitting,
	onClose,
	onReject,
}: RejectPayoutModalProps) {
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (payout) {
			setReason("");
			setError(null);
		}
	}, [payout]);

	if (!payout) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!reason.trim()) {
			setError("Vui lòng nhập lý do từ chối yêu cầu rút tiền");
			return;
		}
		setError(null);
		try {
			await onReject(payout.id, reason.trim());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Từ chối thất bại. Vui lòng thử lại.");
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between border-b border-[#e7eee7] pb-3">
					<h3 className="text-base font-black text-[#10221b]">Từ chối yêu cầu rút tiền</h3>
					<button
						type="button"
						aria-label="Đóng"
						onClick={onClose}
						disabled={isSubmitting}
						className="rounded-xl p-1 text-[#52665b] hover:bg-[#edf3ed]"
					>
						<X className="size-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					<div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs space-y-1">
						<p className="text-rose-950 font-bold">
							Yêu cầu của Host: {payout.hostName} ({formatBookingMoney(payout.amount)})
						</p>
						<p className="text-[#52665b]">
							Sau khi từ chối, toàn bộ số tiền {formatBookingMoney(payout.amount)} sẽ được tự động
							hoàn trả lại vào Ví Host.
						</p>
					</div>

					{error && <p className="text-xs font-bold text-rose-600">{error}</p>}

					<div>
						<label htmlFor="reject-reason" className="block text-xs font-bold text-[#10221b]">
							Lý do từ chối *
						</label>
						<textarea
							id="reject-reason"
							rows={3}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Ví dụ: Sai số tài khoản hoặc tên chủ tài khoản không khớp..."
							className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-xs focus:border-rose-600 focus:outline-none"
							disabled={isSubmitting}
						/>
					</div>

					<div className="flex items-center justify-end gap-3 pt-3 border-t border-[#edf3ed]">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-xl border border-[#cbd9ce] px-4 py-2 text-xs font-bold text-[#425048] hover:bg-[#f1f5f0]"
						>
							Hủy
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
						>
							{isSubmitting ? "Đang xử lý..." : "Xác nhận từ chối"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
