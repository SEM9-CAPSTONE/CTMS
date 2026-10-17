import { X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	icon?: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	size?: "md" | "lg" | "xl";
	/** Blocks closing (X button and Escape) while a request is in flight. */
	isCloseDisabled?: boolean;
	closeLabel?: string;
}

const sizeStyles = {
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-3xl",
};

/** Generic modal shell for forms and details; use ConfirmModal for yes/no confirmations. */
export function Modal({
	isOpen,
	onClose,
	title,
	icon,
	description,
	children,
	size = "lg",
	isCloseDisabled = false,
	closeLabel = "Đóng",
}: ModalProps) {
	const titleId = useId();

	useEffect(() => {
		if (!isOpen || isCloseDisabled) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, isCloseDisabled, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10221b]/50 p-4"
			data-testid="modal-overlay"
		>
			{/* biome-ignore lint/a11y/useSemanticElements: overlay-rendered modal shell; native <dialog> showModal() is not used anywhere in this codebase */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={`flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl ${sizeStyles[size]}`}
			>
				<div className="flex items-start justify-between gap-4 border-b border-[#e0ebe0] px-5 py-4">
					<div className="flex items-center gap-3">
						{icon && <div className="rounded-xl bg-emerald-50 p-2.5 text-[#164027]">{icon}</div>}
						<div>
							<h2 id={titleId} className="text-lg font-extrabold text-[#10221b]">
								{title}
							</h2>
							{description && <p className="text-sm text-[#667a6d]">{description}</p>}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={isCloseDisabled}
						aria-label={closeLabel}
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2] disabled:opacity-50"
					>
						<X className="size-5" />
					</button>
				</div>
				<div className="overflow-y-auto p-5">{children}</div>
			</div>
		</div>
	);
}
