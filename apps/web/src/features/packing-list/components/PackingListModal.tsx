import { ShieldCheck, X } from "lucide-react";
import { useEffect, useId } from "react";
import { PackingListPanel } from "./PackingListPanel";

export interface PackingListModalProps {
	isOpen: boolean;
	onClose: () => void;
	bookingId: string;
	refreshKey?: number | string;
}

export function PackingListModal({
	isOpen,
	onClose,
	bookingId,
	refreshKey = 0,
}: PackingListModalProps) {
	const titleId = useId();

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: modal dialog container with accessible backdrop
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			className={
				isOpen
					? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
					: "hidden"
			}
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-2xl">
				{/* Minimalist Header */}
				<div className="flex items-center justify-between border-b border-[#edf3ed] px-5 py-4">
					<div className="flex items-center gap-2">
						<ShieldCheck className="size-5 text-[#164027]" />
						<h3 id={titleId} className="text-base font-extrabold text-[#10221b]">
							Danh sách đồ cần chuẩn bị
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng pop-up"
						className="rounded-full p-1.5 text-[#667a6d] transition hover:bg-[#edf3ed] hover:text-[#10221b]"
					>
						<X className="size-4" />
					</button>
				</div>

				{/* Modal Body */}
				<div className="flex-1 overflow-y-auto p-5">
					<PackingListPanel bookingId={bookingId} refreshKey={refreshKey} hideCardStyles />
				</div>

				{/* Modal Footer */}
				<div className="flex items-center justify-end border-t border-[#edf3ed] bg-[#f8faf8] px-5 py-3.5">
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-[#cbd9ce] bg-white px-4 py-2 text-xs font-bold text-[#34483b] transition hover:bg-[#f4f7f2]"
					>
						Đóng
					</button>
				</div>
			</div>
		</div>
	);
}
