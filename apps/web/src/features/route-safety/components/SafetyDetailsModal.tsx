import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { safetyDetailView } from "../safety-detail-view";
import type { SafetyFeature } from "../types";

export function SafetyDetailsModal({
	feature,
	onClose,
}: { feature: SafetyFeature; onClose: () => void }) {
	const root = useRef<HTMLDivElement>(null);
	const details = safetyDetailView(feature);
	useEffect(() => {
		const opener = document.activeElement;
		const firstButton = root.current?.querySelector<HTMLButtonElement>("button");
		firstButton?.focus({ preventScroll: true });
		const trapFocus = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const buttons = root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
			const first = buttons?.[0];
			const last = buttons?.[buttons.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		document.addEventListener("keydown", trapFocus);
		return () => {
			document.removeEventListener("keydown", trapFocus);
			if (opener instanceof HTMLElement && opener.isConnected)
				opener.focus({ preventScroll: true });
		};
	}, []);
	return createPortal(
		<div
			ref={root}
			data-safety-ui
			className="pointer-events-auto"
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onMouseDown={(event) => event.stopPropagation()}
		>
			<Modal isOpen onClose={onClose} title={details.title} closeLabel="Đóng thông tin" size="lg">
				<div className="space-y-5">
					<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#10221b]">
						{feature.properties.description}
					</p>
					<dl className="grid gap-4 sm:grid-cols-2">
						{details.fields.map(({ label, value }) => (
							<div key={label} className="min-w-0 space-y-1">
								<dt className="text-xs font-medium text-[#667a6d]">{label}</dt>
								<dd className="break-words text-sm font-semibold text-[#10221b]">{value}</dd>
							</div>
						))}
					</dl>
					{details.note && <p className="text-sm text-[#667a6d]">{details.note}</p>}
					<div className="flex justify-end border-t border-[#e0ebe0] pt-4">
						<Button onClick={onClose}>Đóng</Button>
					</div>
				</div>
			</Modal>
		</div>,
		document.fullscreenElement ?? document.body
	);
}
