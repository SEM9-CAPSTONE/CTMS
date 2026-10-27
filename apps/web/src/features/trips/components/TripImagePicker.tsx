import { Image as ImageIcon, ImagePlus, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tripImageText } from "../trip-image-text";
import {
	MAX_TRIP_IMAGES,
	TRIP_IMAGE_SLOT_IDS,
	TRIP_IMAGE_TYPES,
	isValidTripImage,
} from "../trip-images.constants";
import { TripImagePreview } from "./TripImagePreview";

interface Props {
	files: File[];
	onChange: (files: File[]) => void;
	disabled?: boolean;
	layout?: "dropzone" | "slots";
}
export function TripImagePicker({ files, onChange, disabled = false, layout = "dropzone" }: Props) {
	// The surrounding Create Trip form currently uses Vietnamese.
	const text = tripImageText("vi");
	const input = useRef<HTMLInputElement>(null);
	const dragDepth = useRef(0);
	const [dragging, setDragging] = useState(false);
	const [error, setError] = useState("");
	const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
	const full = files.length >= MAX_TRIP_IMAGES;
	useEffect(() => {
		const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
		setPreviews(next);
		return () => {
			for (const preview of next) URL.revokeObjectURL(preview.url);
		};
	}, [files]);
	function add(selected: File[]) {
		if (disabled || !selected.length) return;
		if (files.length + selected.length > MAX_TRIP_IMAGES) {
			setError(text.limit);
			return;
		}
		if (selected.some((file) => !isValidTripImage(file))) {
			setError(text.invalid);
			return;
		}
		setError("");
		onChange([...files, ...selected]);
	}
	return (
		<section
			aria-label={text.pickerTitle}
			className={
				layout === "slots"
					? "min-w-0 space-y-3 rounded-xl border border-[#e5ece7] bg-[#fafcfb] p-3 sm:p-4"
					: "space-y-4"
			}
		>
			<div className="flex items-center justify-between gap-4">
				<h3 className="flex items-center gap-2 text-sm font-extrabold text-[#10221b]">
					{layout === "slots" && (
						<span className="flex size-8 items-center justify-center rounded-lg bg-[#e6f2ea] text-[#167347]">
							<ImageIcon className="size-4" aria-hidden="true" />
						</span>
					)}
					{text.pickerTitle}
				</h3>
				<span
					className="rounded-full bg-[#edf4ee] px-3 py-1 text-xs font-semibold tabular-nums text-[#667a6d]"
					aria-live="polite"
				>
					{files.length}/{MAX_TRIP_IMAGES}
				</span>
			</div>
			<input
				ref={input}
				type="file"
				multiple
				accept={TRIP_IMAGE_TYPES.join(",")}
				aria-label={text.add}
				className="sr-only"
				tabIndex={-1}
				disabled={disabled || full}
				onChange={(event) => {
					add(Array.from(event.target.files ?? []));
					event.target.value = "";
				}}
			/>
			<div
				data-testid="trip-image-dropzone"
				aria-disabled={disabled}
				className={`rounded-2xl transition-colors ${dragging ? "bg-emerald-50 ring-2 ring-[#548a62] ring-offset-4" : ""} ${disabled ? "opacity-60" : ""}`}
				onDragEnter={(event) => {
					event.preventDefault();
					if (disabled) return;
					dragDepth.current += 1;
					setDragging(true);
				}}
				onDragOver={(event) => {
					event.preventDefault();
					event.dataTransfer.dropEffect = disabled || full ? "none" : "copy";
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					dragDepth.current = Math.max(0, dragDepth.current - 1);
					if (!dragDepth.current) setDragging(false);
				}}
				onDrop={(event) => {
					event.preventDefault();
					dragDepth.current = 0;
					setDragging(false);
					add(Array.from(event.dataTransfer.files));
				}}
			>
				{files.length === 0 && layout !== "slots" ? (
					<div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cadbce] bg-[#f8fbf8] px-5 py-10 text-center">
						<div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#eaf2eb] text-[#548164]">
							<Upload className="size-6" aria-hidden="true" />
						</div>
						<p className="text-base font-semibold text-[#34483b]">{text.dropPrompt}</p>
						<div className="mt-3 flex items-center gap-3 text-sm text-[#75867a]">
							<span>{text.or}</span>
							<button
								type="button"
								disabled={disabled}
								onClick={() => input.current?.click()}
								className="inline-flex items-center gap-2 rounded-xl border border-[#cbd9ce] bg-white px-4 py-2.5 font-semibold text-[#164027] shadow-sm transition hover:border-[#548164] hover:bg-[#eef5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#548164] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
							>
								<ImagePlus className="size-4" aria-hidden="true" />
								{text.choose}
							</button>
						</div>
						<p className="mt-6 text-xs leading-5 text-[#7b8c80]">{text.constraints}</p>
					</div>
				) : (
					<>
						<div
							className={
								layout === "slots"
									? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
									: "grid grid-cols-2 gap-4 lg:grid-cols-3"
							}
						>
							{previews.map((preview, index) => (
								<TripImagePreview
									key={preview.url}
									compact={layout === "slots"}
									url={preview.url}
									name={preview.file.name}
									index={index}
									disabled={disabled}
									onRemove={() => {
										setError("");
										onChange(files.filter((_, i) => i !== index));
									}}
								/>
							))}
							{!full && (
								<button
									type="button"
									disabled={disabled}
									onClick={() => input.current?.click()}
									className={`flex ${layout === "slots" ? "aspect-[2/1] min-h-24 rounded-lg border" : "aspect-[4/3] rounded-2xl border-2"} flex-col items-center justify-center gap-2 border-dashed border-[#91c7a5] bg-[#f5fbf7] text-[#167347] transition hover:border-[#548164] hover:bg-[#edf5ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#548164] focus-visible:ring-offset-2 disabled:cursor-not-allowed`}
								>
									<Plus className="size-7" strokeWidth={1.5} aria-hidden="true" />
									<span className="text-sm font-semibold">{text.add}</span>
								</button>
							)}
							{layout === "slots" &&
								TRIP_IMAGE_SLOT_IDS.slice(files.length + (full ? 0 : 1)).map((slotId) => (
									<div
										key={slotId}
										data-testid="trip-image-placeholder"
										aria-hidden="true"
										className="flex aspect-[2/1] min-h-24 items-center justify-center rounded-lg border border-dashed border-[#dce4e0] bg-white/60"
									>
										<ImageIcon className="size-6 text-[#a4adbd]" />
									</div>
								))}
						</div>
						<p className="mt-3 text-xs leading-5 text-[#7b8c80]">{text.constraints}</p>
					</>
				)}
			</div>
			{error && (
				<p role="alert" className="text-sm text-red-700">
					{error}
				</p>
			)}
		</section>
	);
}
