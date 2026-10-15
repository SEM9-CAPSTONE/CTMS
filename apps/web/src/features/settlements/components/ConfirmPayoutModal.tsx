import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import type { AdminPayoutItem } from "../types";

export interface ConfirmPayoutModalProps {
	payout: AdminPayoutItem | null;
	isSubmitting: boolean;
	onClose: () => void;
	onConfirm: (payoutId: string, transactionRef: string, adminNotes?: string) => Promise<void>;
}

export function ConfirmPayoutModal({
	payout,
	isSubmitting,
	onClose,
	onConfirm,
}: ConfirmPayoutModalProps) {
	const [transactionRef, setTransactionRef] = useState("");
	const [adminNotes, setAdminNotes] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (payout) {
			setTransactionRef("");
			setAdminNotes("");
			setError(null);
		}
	}, [payout]);

	if (!payout) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!transactionRef.trim()) {
			setError("Vui lòng nhập mã giao dịch ngân hàng (FT/Ref)");
			return;
		}
		setError(null);
		try {
			await onConfirm(payout.id, transactionRef.trim(), adminNotes.trim() || undefined);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Xác nhận chuyển tiền thất bại.");
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between border-b border-[#e7eee7] pb-3">
					<h3 className="text-base font-black text-[#10221b]">Xác nhận chuyển khoản cho Host</h3>
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
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-1">
						<div className="flex items-center justify-between">
							<span className="text-emerald-800 font-bold">Số tiền chuyển khoản:</span>
							<span className="text-base font-black text-[#164027]">
								{formatBookingMoney(payout.amount)}
							</span>
						</div>
						<p className="text-emerald-950 font-semibold pt-1">
							Host: <strong>{payout.hostName}</strong>
						</p>
						<p className="text-[#52665b]">
							{payout.bankName} - Số TK:{" "}
							<strong className="font-mono text-[#10221b]">{payout.accountNumber}</strong> (
							{payout.accountHolderName})
						</p>
					</div>

					{error && <p className="text-xs font-bold text-rose-600">{error}</p>}

					<div>
						<label htmlFor="tx-ref" className="block text-xs font-bold text-[#10221b]">
							Mã giao dịch ngân hàng (FT / Ref No.) *
						</label>
						<input
							id="tx-ref"
							type="text"
							value={transactionRef}
							onChange={(e) => setTransactionRef(e.target.value)}
							placeholder="Ví dụ: FT2610149999..."
							className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-xs font-mono font-bold focus:border-[#164027] focus:outline-none"
							disabled={isSubmitting}
						/>
					</div>

					<div>
						<label htmlFor="tx-notes" className="block text-xs font-bold text-[#10221b]">
							Ghi chú đối soát (Tùy chọn)
						</label>
						<input
							id="tx-notes"
							type="text"
							value={adminNotes}
							onChange={(e) => setAdminNotes(e.target.value)}
							placeholder="Ghi chú nội bộ..."
							className="mt-1 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-xs focus:border-[#164027] focus:outline-none"
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
							className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#11321f] disabled:opacity-50"
						>
							{isSubmitting ? "Đang xử lý..." : "Xác nhận đã chuyển tiền"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
