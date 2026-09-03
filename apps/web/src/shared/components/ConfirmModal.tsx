import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";

export type ConfirmVariant = "success" | "danger" | "warning" | "info";

export interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void | Promise<void>;
	title: string;
	description: ReactNode;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
	isLoading?: boolean;
}

export function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
	confirmText = "Xác nhận",
	cancelText = "Hủy bỏ",
	variant = "success",
	isLoading = false,
}: ConfirmModalProps) {
	if (!isOpen) return null;

	const handleConfirm = async () => {
		await onConfirm();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
			data-testid="confirm-modal-overlay"
		>
			<div
				className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200"
				data-testid="confirm-modal"
			>
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						<div
							className={`rounded-2xl p-3 ${
								variant === "danger"
									? "bg-red-50 text-red-600"
									: variant === "warning"
										? "bg-amber-50 text-amber-600"
										: variant === "info"
											? "bg-blue-50 text-blue-600"
											: "bg-emerald-50 text-emerald-600"
							}`}
						>
							{variant === "danger" && <AlertTriangle className="size-6" />}
							{variant === "warning" && <AlertTriangle className="size-6" />}
							{variant === "info" && <Info className="size-6" />}
							{variant === "success" && <CheckCircle2 className="size-6" />}
						</div>
						<div>
							<h3 className="font-extrabold text-lg text-[#10221b]">{title}</h3>
						</div>
					</div>

					<button
						type="button"
						onClick={onClose}
						disabled={isLoading}
						className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors"
					>
						<X className="size-5" />
					</button>
				</div>

				<div className="text-sm font-medium text-[#425048] leading-relaxed">{description}</div>

				<div className="flex items-center justify-end gap-3 pt-2">
					<button
						type="button"
						data-testid="confirm-modal-cancel"
						onClick={onClose}
						disabled={isLoading}
						className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
					>
						{cancelText}
					</button>
					<button
						type="button"
						data-testid="confirm-modal-submit"
						onClick={() => void handleConfirm()}
						disabled={isLoading}
						className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
							variant === "danger"
								? "bg-red-600 hover:bg-red-700"
								: variant === "warning"
									? "bg-amber-600 hover:bg-amber-700"
									: variant === "info"
										? "bg-blue-600 hover:bg-blue-700"
										: "bg-[#164027] hover:bg-[#10301d]"
						}`}
					>
						{isLoading && <Loader2 className="size-4 animate-spin" />}
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}
