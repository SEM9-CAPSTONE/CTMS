import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface Props {
	label: string;
	value: string;
	options: ReadonlyArray<{ value: string; label: string }>;
	onChange: (value: string) => void;
	disabled?: boolean;
}

/** Keyboard-accessible single select using the shared form colours. */
export function SelectField({ label, value, options, onChange, disabled }: Props) {
	const id = useId();
	const root = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [index, setIndex] = useState(0);
	useEffect(() => {
		if (!open) return;
		const dismiss = (event: PointerEvent) => {
			if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("pointerdown", dismiss);
		return () => document.removeEventListener("pointerdown", dismiss);
	}, [open]);
	const select = (next: number) => {
		if (options[next]) onChange(options[next].value);
		setOpen(false);
	};
	return (
		<div
			ref={root}
			className="relative min-w-0 text-sm font-normal"
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
			}}
		>
			<button
				type="button"
				// biome-ignore lint/a11y/useSemanticElements: Custom select-only combobox uses aria-activedescendant for keyboard focus.
				role="combobox"
				aria-label={label}
				aria-expanded={open}
				aria-controls={`${id}-options`}
				aria-haspopup="listbox"
				aria-activedescendant={open ? `${id}-${index}` : undefined}
				disabled={disabled}
				className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-50"
				onClick={() => {
					setIndex(
						Math.max(
							0,
							options.findIndex((item) => item.value === value)
						)
					);
					setOpen(!open);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						setOpen(false);
					} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						if (!open) {
							setIndex(
								Math.max(
									0,
									options.findIndex((item) => item.value === value)
								)
							);
							setOpen(true);
						} else
							setIndex(
								(current) =>
									(current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
							);
					} else if (open && (event.key === "Enter" || event.key === " ")) {
						event.preventDefault();
						select(index);
					} else if (open && (event.key === "Home" || event.key === "End")) {
						event.preventDefault();
						setIndex(event.key === "Home" ? 0 : options.length - 1);
					}
				}}
			>
				<span>{options.find((item) => item.value === value)?.label ?? "Chọn một mục"}</span>
				<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-[#627769]" />
			</button>
			{open && (
				<div
					id={`${id}-options`}
					// biome-ignore lint/a11y/useSemanticElements: Popup of the custom select-only combobox.
					role="listbox"
					tabIndex={-1}
					aria-label={label}
					className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-1 shadow-lg"
				>
					{options.map((item, position) => (
						<div
							key={item.value}
							id={`${id}-${position}`}
							// biome-ignore lint/a11y/useSemanticElements: Custom listbox option, focus is tracked by aria-activedescendant.
							role="option"
							tabIndex={-1}
							aria-selected={item.value === value}
							className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 ${position === index ? "bg-brand-light" : "hover:bg-brand-light"}`}
							onPointerMove={() => setIndex(position)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => select(position)}
						>
							{item.label}
							{item.value === value && <Check aria-hidden="true" className="size-4" />}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
