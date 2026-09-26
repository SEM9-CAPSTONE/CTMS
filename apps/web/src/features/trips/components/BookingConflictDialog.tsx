import { AlertTriangle, RefreshCw, X } from "lucide-react";

export interface BookingConflictDialogProps {
	open: boolean;
	message?: string | null;
	requestedSeats?: number;
	isReloading?: boolean;
	onReload: () => void;
	onRetry?: () => void;
	onClose: () => void;
}

export function BookingConflictDialog({
	open,
	message,
	requestedSeats,
	isReloading = false,
	onReload,
	onRetry,
	onClose,
}: BookingConflictDialogProps) {
	if (!open) return null;

	return (
		<div
			data-testid="booking-conflict-modal-backdrop"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/60 p-4 backdrop-blur-xs"
		>
			<dialog
				open
				aria-labelledby="booking-conflict-title"
				data-testid="booking-conflict-dialog"
				className="relative m-0 w-full max-w-md rounded-3xl border border-[#dfe8df] bg-white p-0 text-[#10221b] shadow-2xl"
			>
				{/* Header */}
				<header className="flex items-start justify-between border-b border-[#dfe8df] p-6">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
							<AlertTriangle className="size-5" />
						</div>
						<div>
							<h3 id="booking-conflict-title" className="text-base font-extrabold text-[#10221b]">
								Số chỗ vừa có thay đổi
							</h3>
							<p className="text-xs font-semibold text-[#667a6d]">
								Xung đột đặt chỗ (Overbooking guard)
							</p>
						</div>
					</div>

					<button
						type="button"
						aria-label="Đóng thông báo xung đột"
						onClick={onClose}
						className="rounded-xl p-2 text-[#667a6d] transition hover:bg-gray-100 hover:text-[#10221b]"
					>
						<X className="size-5" />
					</button>
				</header>

				{/* Body */}
				<div className="space-y-4 p-6 text-xs text-[#52665b]">
					<div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
						<p className="font-bold text-amber-900 leading-relaxed">
							{message ||
								"Rất tiếc, số lượng chỗ trống khả dụng vừa được cập nhật do có khách hàng khác hoàn tất đặt chỗ trước."}
						</p>
					</div>

					<p className="leading-relaxed">
						Theo quy định an toàn hệ thống, CTMS không cho phép vượt quá sức chứa tối đa của chuyến
						đi.
						{requestedSeats && requestedSeats > 1 ? ` Bạn đã yêu cầu ${requestedSeats} chỗ. ` : " "}
						Dữ liệu bạn đã nhập vẫn được giữ nguyên. Vui lòng tải lại để xem số chỗ còn trống mới
						nhất hoặc điều chỉnh số lượng khách tham gia.
					</p>
				</div>

				{/* Footer CTA */}
				<footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#dfe8df] bg-[#f8faf7] p-5 rounded-b-3xl">
					<button
						type="button"
						onClick={onClose}
						className="rounded-2xl border border-[#dfe8df] bg-white px-4 py-2.5 text-xs font-bold text-[#55685a] transition hover:bg-[#edf3ed] hover:text-[#10221b]"
					>
						Đóng
					</button>

					{onRetry && (
						<button
							type="button"
							onClick={onRetry}
							className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
						>
							Thử lại
						</button>
					)}

					<button
						type="button"
						onClick={onReload}
						disabled={isReloading}
						className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#164027] px-5 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#0f2e1c] disabled:opacity-50"
					>
						<RefreshCw className={`size-3.5 ${isReloading ? "animate-spin" : ""}`} />
						<span>{isReloading ? "Đang tải lại..." : "Tải lại dữ liệu"}</span>
					</button>
				</footer>
			</dialog>
		</div>
	);
}
