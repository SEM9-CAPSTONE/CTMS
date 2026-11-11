import { ImageIcon, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTripImages } from "../hooks/useTripImages";
import type { TripImage } from "../services/trips.service";
import { tripImageText } from "../trip-image-text";
import {
	MAX_TRIP_IMAGES,
	TRIP_IMAGE_SLOT_IDS,
	TRIP_IMAGE_TYPES,
	isValidTripImage,
} from "../trip-images.constants";
import { TripImagePreview } from "./TripImagePreview";
export interface PendingTripImages {
	retained: TripImage[];
	files: File[];
}
interface Props {
	tripId: string;
	value: PendingTripImages | null;
	onChange: (value: PendingTripImages) => void;
}
export function PendingTripImageEditor({ tripId, value, onChange }: Props) {
	const { query } = useTripImages(tripId);
	const input = useRef<HTMLInputElement>(null);
	const [previews, setPreviews] = useState<string[]>([]);
	const [error, setError] = useState("");
	const text = tripImageText("vi");
	useEffect(() => {
		if (!value && query.data) onChange({ retained: query.data, files: [] });
	}, [query.data, value, onChange]);
	const files = value?.files;
	useEffect(() => {
		const urls = (files ?? []).map((f) => URL.createObjectURL(f));
		setPreviews(urls);
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
		};
	}, [files]);
	const count = (value?.retained.length ?? 0) + (files?.length ?? 0);
	const add = (selected: File[]) => {
		if (!value || !selected.length) return;
		if (count + selected.length > MAX_TRIP_IMAGES) {
			setError(text.limit);
			return;
		}
		if (selected.some((file) => !isValidTripImage(file))) {
			setError(text.invalid);
			return;
		}
		setError("");
		onChange({ ...value, files: [...value.files, ...selected] });
	};
	return (
		<section
			aria-label={text.pickerTitle}
			className="space-y-3 rounded-xl border border-[#e5ece7] bg-[#fafcfb] p-4"
		>
			<div className="flex items-center justify-between">
				<h3 className="flex items-center gap-2 text-sm font-extrabold">
					<ImageIcon className="size-5 text-[#167347]" />
					{text.pickerTitle}
				</h3>
				<span className="text-xs text-[#667a6d]">{count}/5</span>
			</div>
			{query.isPending && !value && <output>{text.loading}</output>}
			{query.isError && !value && (
				<p role="alert">
					{text.failed}{" "}
					<button type="button" onClick={() => void query.refetch()}>
						{text.retry}
					</button>
				</p>
			)}
			<input
				ref={input}
				type="file"
				multiple
				accept={TRIP_IMAGE_TYPES.join(",")}
				aria-label={text.add}
				tabIndex={-1}
				className="sr-only"
				disabled={!value || count >= 5}
				onChange={(event) => {
					add(Array.from(event.target.files ?? []));
					event.target.value = "";
				}}
			/>
			<div
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => {
					e.preventDefault();
					add(Array.from(e.dataTransfer.files));
				}}
			>
				{value?.retained.map((image, index) => (
					<TripImagePreview
						compact
						key={image.id}
						url={image.url}
						name={`${text.title} ${index + 1}`}
						index={index}
						disabled={false}
						onRemove={() =>
							onChange({ ...value, retained: value.retained.filter((i) => i.id !== image.id) })
						}
					/>
				))}
				{previews.map((url, index) => (
					<TripImagePreview
						compact
						key={url}
						url={url}
						name={files?.[index]?.name ?? text.title}
						index={(value?.retained.length ?? 0) + index}
						disabled={false}
						onRemove={() => {
							if (value) onChange({ ...value, files: value.files.filter((_, i) => i !== index) });
						}}
					/>
				))}
				{count < 5 && (
					<button
						type="button"
						disabled={!value}
						onClick={() => input.current?.click()}
						className="flex aspect-[2/1] min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#91c7a5] text-[#167347]"
					>
						<Plus className="size-6" />
						{text.add}
					</button>
				)}
				{TRIP_IMAGE_SLOT_IDS.slice(count + 1).map((slotId) => (
					<div
						key={slotId}
						aria-hidden="true"
						className="flex aspect-[2/1] min-h-24 items-center justify-center rounded-lg border border-dashed border-[#dce4e0] bg-white/60"
					>
						<ImageIcon className="size-6 text-[#a4adbd]" />
					</div>
				))}
			</div>
			<p className="text-xs text-[#667a6d]">
				{text.constraints} · Ảnh chỉ được lưu khi hoàn tất cập nhật.
			</p>
			{error && (
				<p role="alert" className="text-sm text-red-700">
					{error}
				</p>
			)}
		</section>
	);
}
