import { useLayoutEffect, useRef } from "react";

export function useNotificationPopover(open: boolean, close: () => void) {
	const trigger = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLDialogElement>(null);
	const closeRef = useRef(close);
	closeRef.current = close;
	useLayoutEffect(() => {
		if (!open || !panel.current || !trigger.current) return;
		const element = panel.current;
		const position = () => {
			const bounds = trigger.current?.getBoundingClientRect();
			if (!bounds) return;
			const width = Math.min(456, window.innerWidth - 24);
			element.style.width = `${width}px`;
			element.style.left = `${Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))}px`;
			element.style.top = `${Math.min(bounds.bottom + 8, window.innerHeight - 180)}px`;
			element.style.maxHeight = `${Math.max(160, window.innerHeight - bounds.bottom - 20)}px`;
		};
		const outside = (event: Event) => {
			if (
				event.target instanceof Node &&
				!element.contains(event.target) &&
				!trigger.current?.contains(event.target)
			)
				closeRef.current();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeRef.current();
				trigger.current?.focus();
			}
		};
		position();
		element.querySelector<HTMLButtonElement>('button[aria-label="Đóng thông báo"]')?.focus();
		document.addEventListener("pointerdown", outside);
		document.addEventListener("focusin", outside);
		document.addEventListener("keydown", onKey);
		window.addEventListener("resize", position);
		return () => {
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("focusin", outside);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("resize", position);
		};
	}, [open]);
	return { trigger, panel };
}
