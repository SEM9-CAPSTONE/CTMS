import { useEffect, useState } from "react";
import { useTripImages } from "../hooks/useTripImages";
import { tripImageText } from "../trip-image-text";

interface Props {
	tripId: string;
	status: string;
	canManage: boolean;
	onImagesChange: (urls: string[]) => void;
}
export function TripImageGallery({ tripId, status, canManage, onImagesChange }: Props) {
	const { query, add, remove } = useTripImages(tripId);
	const [error, setError] = useState("");
	const text = tripImageText();
	const images = query.data ?? [];
	const busy = add.isPending || remove.isPending;
	const editable =
		canManage && !["pending_approval", "ongoing", "completed", "cancelled"].includes(status);
	useEffect(() => {
		if (query.data) onImagesChange(query.data.map((i) => i.url));
	}, [query.data, onImagesChange]);
	async function upload(file?: File) {
		if (!file) return;
		setError("");
		if (images.length >= 5) {
			setError(text.limit);
			return;
		}
		if (
			!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
			file.size > 5 * 1024 * 1024
		) {
			setError(text.invalid);
			return;
		}
		try {
			await add.mutateAsync(file);
		} catch {
			setError(text.failed);
		}
	}
	return (
		<section
			aria-label={text.title}
			className="rounded-2xl border border-[#dfe8df] bg-white p-4 space-y-3"
		>
			<h2 className="font-bold">
				{text.title} ({images.length}/5)
			</h2>
			{query.isPending && <output>{text.loading}</output>}
			{query.isError && (
				<div role="alert">
					{text.failed}{" "}
					<button type="button" onClick={() => void query.refetch()}>
						{text.retry}
					</button>
				</div>
			)}
			<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
				{images.map((image, index) => (
					<div key={image.id} className={index === 0 ? "col-span-2 md:col-span-1" : ""}>
						<a href={image.url} target="_blank" rel="noreferrer">
							<img
								src={image.url}
								alt={`${text.title} ${index + 1}`}
								loading={index === 0 ? "eager" : "lazy"}
								className="aspect-[4/3] w-full rounded-xl object-cover"
							/>
						</a>
						{index === 0 && <span className="text-xs">{text.cover}</span>}
						{editable && (
							<button
								type="button"
								disabled={busy}
								className="block text-sm text-red-700 disabled:opacity-50"
								aria-label={`${text.remove} ${index + 1}`}
								onClick={async () => {
									setError("");
									try {
										await remove.mutateAsync(image.id);
									} catch {
										setError(text.failed);
									}
								}}
							>
								{text.remove}
							</button>
						)}
					</div>
				))}
			</div>
			{editable && (
				<>
					<p className="text-xs text-slate-600">{text.hint}</p>
					<input
						aria-label={text.add}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						disabled={busy || query.isPending || query.isError || images.length >= 5}
						onChange={(e) => {
							void upload(e.target.files?.[0]);
							e.target.value = "";
						}}
					/>
				</>
			)}
			{remove.isSuccess && <output className="text-xs">{text.queued}</output>}
			{error && (
				<p role="alert" className="text-red-700">
					{error}
				</p>
			)}
		</section>
	);
}
