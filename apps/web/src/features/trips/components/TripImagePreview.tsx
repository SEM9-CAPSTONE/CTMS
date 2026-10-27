import { X } from "lucide-react";
import { tripImageText } from "../trip-image-text";
interface Props {
	url: string;
	name: string;
	index: number;
	disabled: boolean;
	onRemove: () => void;
	compact?: boolean;
}
export function TripImagePreview({ url, name, index, disabled, onRemove, compact = false }: Props) {
	const text = tripImageText("vi");
	return (
		<div
			className={`group relative overflow-hidden bg-[#edf2ed] ring-1 ring-black/5 ${compact ? "aspect-[2/1] min-h-24 rounded-lg" : "aspect-[4/3] rounded-2xl"}`}
		>
			<img src={url} alt={name} className="h-full w-full object-cover" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
			{index === 0 && (
				<span
					className={`absolute rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-[#164027] shadow-sm ${compact ? "bottom-2 left-2" : "bottom-3 left-3"}`}
				>
					{text.coverBadge}
				</span>
			)}
			<button
				type="button"
				disabled={disabled}
				aria-label={`${text.remove} ${index + 1}`}
				onClick={onRemove}
				className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#164027] disabled:cursor-not-allowed"
			>
				<X className="size-4" aria-hidden="true" />
			</button>
		</div>
	);
}
