import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface SidebarPopoverProps {
	anchor: HTMLElement;
	id: string;
	placement?: "right" | "above";
	onClose: () => void;
	children: ReactNode;
}

export function SidebarPopover({
	anchor,
	id,
	placement = "right",
	onClose,
	children,
}: SidebarPopoverProps) {
	const ref = useRef<HTMLDivElement>(null);
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	useLayoutEffect(() => {
		const panel = ref.current;
		if (!panel) return;
		const gap = 8;
		const position = () => {
			const bounds = anchor.getBoundingClientRect();
			const right = window.innerWidth - panel.offsetWidth - gap;
			const bottom = window.innerHeight - panel.offsetHeight - gap;
			const sidebarRight = anchor.closest("aside")?.getBoundingClientRect().right ?? bounds.right;
			const left = placement === "above" ? bounds.left : sidebarRight + gap;
			const top = placement === "above" ? bounds.top - panel.offsetHeight - gap : bounds.top;
			panel.style.left = `${Math.max(gap, Math.min(left, right))}px`;
			panel.style.top = `${Math.max(gap, Math.min(top, bottom))}px`;
		};
		const dismissOutside = (event: Event) => {
			const target = event.target;
			if (target instanceof Node && !anchor.contains(target) && !panel.contains(target)) {
				closeRef.current();
			}
		};
		const dismissOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			closeRef.current();
			anchor.focus();
		};

		position();
		(panel.querySelector<HTMLElement>("a[href], button:not(:disabled)") ?? panel).focus();
		document.addEventListener("pointerdown", dismissOutside);
		document.addEventListener("focusin", dismissOutside);
		document.addEventListener("keydown", dismissOnEscape);
		window.addEventListener("resize", position);
		window.addEventListener("scroll", position, true);
		return () => {
			document.removeEventListener("pointerdown", dismissOutside);
			document.removeEventListener("focusin", dismissOutside);
			document.removeEventListener("keydown", dismissOnEscape);
			window.removeEventListener("resize", position);
			window.removeEventListener("scroll", position, true);
		};
	}, [anchor, placement]);

	return createPortal(
		<div
			ref={ref}
			id={id}
			tabIndex={-1}
			className="fixed z-50 max-h-[calc(100dvh-1rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-2 shadow-lg outline-none"
		>
			{children}
		</div>,
		anchor.closest("[data-sidebar-drawer]") ?? document.body
	);
}
