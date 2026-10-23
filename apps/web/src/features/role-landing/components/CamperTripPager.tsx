import { ChevronLeft, ChevronRight } from "lucide-react";
interface Props {
	index: number;
	canPrevious: boolean;
	canNext: boolean;
	disabled: boolean;
	onPrevious: () => void;
	onNext: () => void;
}
export function CamperTripPager({
	index,
	canPrevious,
	canNext,
	disabled,
	onPrevious,
	onNext,
}: Props) {
	return (
		<nav
			aria-label="Chuyển chuyến hiển thị"
			className="pointer-events-none absolute inset-x-2 bottom-6 z-10 flex items-center justify-between"
		>
			<button
				type="button"
				disabled={!canPrevious || disabled}
				onClick={onPrevious}
				aria-label="Chuyến trước"
				title="Chuyến trước"
				className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-[#cbd9ce] bg-white text-[#164027] shadow-sm transition hover:bg-[#f4f7f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164027] disabled:cursor-not-allowed disabled:opacity-30"
			>
				<ChevronLeft className="size-5" aria-hidden="true" />
			</button>
			<span className="sr-only" aria-live="polite">
				Chuyến {Math.max(index + 1, 1)}
			</span>
			<button
				type="button"
				disabled={!canNext || disabled}
				onClick={onNext}
				aria-label="Chuyến tiếp"
				title="Chuyến tiếp"
				className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-[#164027] bg-[#164027] text-white shadow-sm transition hover:bg-[#0f2e1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164027] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
			>
				<ChevronRight className="size-5" aria-hidden="true" />
			</button>
		</nav>
	);
}
