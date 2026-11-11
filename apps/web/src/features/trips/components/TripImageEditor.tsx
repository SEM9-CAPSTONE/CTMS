import { ImageIcon, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTripImages } from "../hooks/useTripImages";
import { tripImageText } from "../trip-image-text";
import {
	MAX_TRIP_IMAGES,
	TRIP_IMAGE_SLOT_IDS,
	TRIP_IMAGE_TYPES,
	isValidTripImage,
} from "../trip-images.constants";
import { TripImagePreview } from "./TripImagePreview";
interface Props {
	tripId: string;
	disabled?: boolean;
	onBusyChange: (busy: boolean) => void;
}
export function TripImageEditor({ tripId, disabled = false, onBusyChange }: Props) {
	const { query, add, remove } = useTripImages(tripId);
	const input = useRef<HTMLInputElement>(null);
	const working = useRef(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const text = tripImageText("vi");
	const images = query.data ?? [];
	const blocked = disabled || busy || query.isPending || query.isError;
	async function perform(action: () => Promise<unknown>) {
		if (blocked || working.current) return;
		working.current = true;
		setBusy(true);
		onBusyChange(true);
		setError("");
		try {
			await action();
		} catch {
			setError(text.failed);
		} finally {
			working.current = false;
			setBusy(false);
			onBusyChange(false);
		}
	}
	async function upload(files: File[]) {
		if (!files.length || blocked || working.current) return;
		if (images.length + files.length > MAX_TRIP_IMAGES) {
			setError(text.limit);
			return;
		}
		if (files.some((file) => !isValidTripImage(file))) {
			setError(text.invalid);
			return;
		}
		await perform(async () => {
			for (const file of files) await add.mutateAsync(file);
		});
	}
	return (
		<section
			aria-label={text.pickerTitle}
			className="min-w-0 space-y-3 rounded-xl border border-[#e5ece7] bg-[#fafcfb] p-3 sm:p-4"
		>
			<div className="flex items-center justify-between gap-4">
				<h3 className="flex items-center gap-2 text-sm font-extrabold text-[#10221b]">
					<span className="flex size-8 items-center justify-center rounded-lg bg-[#e6f2ea] text-[#167347]">
						<ImageIcon className="size-4" aria-hidden="true" />
					</span>
					{text.pickerTitle}
				</h3>
				<span
					aria-live="polite"
					className="rounded-full bg-[#edf4ee] px-3 py-1 text-xs font-semibold text-[#667a6d]"
				>
					{images.length}/{MAX_TRIP_IMAGES}
				</span>
			</div>
			{query.isPending && <output>{text.loading}</output>}
			{query.isError && (
				<p role="alert" className="text-sm text-red-700">
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
				className="sr-only"
				tabIndex={-1}
				disabled={blocked || images.length >= MAX_TRIP_IMAGES}
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = "";
					void upload(files);
				}}
			/>
			<div
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
				onDragOver={(event) => {
					event.preventDefault();
					event.dataTransfer.dropEffect = blocked ? "none" : "copy";
				}}
				onDrop={(event) => {
					event.preventDefault();
					void upload(Array.from(event.dataTransfer.files));
				}}
			>
				{images.map((image, index) => (
					<TripImagePreview
						compact
						key={image.id}
						url={image.url}
						name={`${text.title} ${index + 1}`}
						index={index}
						disabled={blocked}
						onRemove={() => void perform(() => remove.mutateAsync(image.id))}
					/>
				))}
				{images.length < MAX_TRIP_IMAGES && (
					<button
						type="button"
						disabled={blocked}
						onClick={() => input.current?.click()}
						className="flex aspect-[2/1] min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#91c7a5] bg-[#f5fbf7] text-[#167347] hover:bg-[#edf5ee] disabled:opacity-60"
					>
						<Plus className="size-7" aria-hidden="true" />
						<span className="text-sm font-semibold">{text.add}</span>
					</button>
				)}
				{TRIP_IMAGE_SLOT_IDS.slice(images.length + 1).map((slotId) => (
					<div
						key={slotId}
						aria-hidden="true"
						className="flex aspect-[2/1] min-h-24 items-center justify-center rounded-lg border border-dashed border-[#dce4e0] bg-white/60"
					>
						<ImageIcon className="size-6 text-[#a4adbd]" />
					</div>
				))}
			</div>
			<p className="text-xs leading-5 text-[#7b8c80]">{text.constraints}</p>
			<output aria-live="polite" className="block text-xs text-[#667a6d]">
				{busy ? "Đang lưu ảnh…" : "Thay đổi ảnh được tự động lưu."}
			</output>
			{error && (
				<p role="alert" className="text-sm text-red-700">
					{error}
				</p>
			)}
		</section>
	);
}
