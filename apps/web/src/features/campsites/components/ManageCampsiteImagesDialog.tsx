import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	ImagePlus,
	Loader2,
	Plus,
	RefreshCw,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { useUpdateCampsiteMedia } from "../hooks/useUpdateCampsiteMedia";
import {
	type UpdateCampsiteMediaFormValues,
	updateCampsiteMediaSchema,
} from "../schema/create-campsite.schema";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite } from "../types";

export interface ManageCampsiteImagesDialogProps {
	open: boolean;
	campsite: CreatedCampsite | null;
	onClose: () => void;
	onUpdateSuccess?: (updatedCampsite: CreatedCampsite) => void;
}

function ErrorText({ message }: { message?: string }) {
	if (!message) {
		return null;
	}

	return <p className="mt-1 text-xs font-semibold text-red-600">{message}</p>;
}

export function ManageCampsiteImagesDialog({
	open,
	campsite,
	onClose,
	onUpdateSuccess,
}: ManageCampsiteImagesDialogProps) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const [uploadError, setUploadError] = useState("");

	const mediaState = useUpdateCampsiteMedia(campsite?.id ?? "");

	const {
		register,
		control,
		handleSubmit,
		formState: { errors },
		reset: resetForm,
	} = useForm<UpdateCampsiteMediaFormValues>({
		resolver: zodResolver(updateCampsiteMediaSchema),
		defaultValues: { initialImages: [] },
		mode: "onSubmit",
	});

	const { fields, append, remove, move } = useFieldArray({
		control,
		name: "initialImages",
	});

	// Reset form when dialog opens with a new/updated campsite
	useEffect(() => {
		if (open && campsite) {
			resetForm({
				initialImages: campsite.media.map((image) => ({
					url: image.url,
					sortOrder: String(image.sortOrder),
				})),
			});
			mediaState.reset();
			setUploadError("");
		}
	}, [open, campsite, resetForm, mediaState.reset]);

	if (!open || !campsite) {
		return null;
	}

	const uploadImages = async (files: FileList | null) => {
		if (!files || files.length === 0) {
			return;
		}

		setUploadError("");
		setIsUploadingImage(true);

		try {
			const availableSlots = Math.max(10 - fields.length, 0);
			const selectedFiles = Array.from(files).slice(0, availableSlots);

			for (const [index, file] of selectedFiles.entries()) {
				const uploaded = await campsitesService.uploadMedia(file);
				append({
					url: uploaded.url,
					sortOrder: String(fields.length + index),
				});
			}
		} catch (uploadFailure) {
			setUploadError(
				uploadFailure instanceof Error
					? uploadFailure.message
					: "Không thể tải ảnh lên. Vui lòng thử lại."
			);
		} finally {
			setIsUploadingImage(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const submitForm = handleSubmit(async (values) => {
		const mediaPayload = values.initialImages.map((image, index) => ({
			url: image.url.trim(),
			type: "photo" as const,
			sortOrder: image.sortOrder !== "" ? Number(image.sortOrder) : index,
		}));

		const updated = await mediaState.submit(mediaPayload);
		if (updated && onUpdateSuccess) {
			onUpdateSuccess({
				...campsite,
				media: updated,
			});
		}
	});

	const handleRetry = async () => {
		const updated = await mediaState.retry();
		if (updated && onUpdateSuccess) {
			onUpdateSuccess({
				...campsite,
				media: updated,
			});
		}
	};

	return (
		<div
			aria-modal="true"
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10221b]/50 p-4 font-sans"
			aria-labelledby="manage-images-dialog-title"
		>
			<div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-5 py-4">
					<div>
						<h2 id="manage-images-dialog-title" className="text-lg font-extrabold text-[#10221b]">
							Quản lý ảnh khu cắm trại
						</h2>
						<p className="text-xs text-[#667a6d] mt-0.5">{campsite.name}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={mediaState.isSubmitting}
						aria-label="Đóng hộp thoại"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2] disabled:opacity-50"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Body */}
				<div className="p-5 overflow-y-auto space-y-4 flex-1">
					{mediaState.error && (
						<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
							<div className="flex items-start gap-3">
								<AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
								<div className="flex-1">
									<p className="text-sm font-bold text-red-800">Không thể cập nhật ảnh</p>
									<p className="mt-1 text-sm text-red-700">{mediaState.error.message}</p>
									{mediaState.error.canRetry && (
										<button
											type="button"
											disabled={mediaState.isSubmitting}
											onClick={handleRetry}
											className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
										>
											<RefreshCw className="size-4" />
											Thử gửi lại
										</button>
									)}
								</div>
							</div>
						</div>
					)}

					<div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8faf7] border border-[#e0ebe0] p-4 rounded-xl">
						<div>
							<p className="text-sm font-bold text-[#10221b]">Hình ảnh hiển thị</p>
							<p className="text-xs text-[#667a6d] mt-0.5">Tối thiểu 1 ảnh, tối đa 10 ảnh.</p>
						</div>

						<button
							type="button"
							disabled={mediaState.isSubmitting || isUploadingImage || fields.length >= 10}
							onClick={() => fileInputRef.current?.click()}
							className="inline-flex items-center gap-2 rounded-xl bg-[#eaf4eb] px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#dcebdd] disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isUploadingImage ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
							{isUploadingImage ? "Đang tải..." : "Thêm ảnh"}
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							aria-label="Chọn ảnh từ thiết bị"
							className="sr-only"
							disabled={mediaState.isSubmitting || isUploadingImage || fields.length >= 10}
							onChange={(event) => void uploadImages(event.target.files)}
						/>
					</div>

					{uploadError && <p className="text-sm font-semibold text-red-600">{uploadError}</p>}

					{fields.length === 0 ? (
						<div
							data-testid="empty-images-state"
							className="rounded-xl border border-dashed border-[#cbd9ce] bg-[#f8faf7] px-5 py-12 text-center"
						>
							<ImagePlus className="mx-auto size-12 text-[#8fa096]" />
							<p className="mt-3 text-sm font-bold text-[#425048]">Chưa có ảnh hiển thị</p>
							<p className="mt-1 text-xs text-[#788b7e]">
								Nhấn “Thêm ảnh” để bổ sung ảnh khu cắm trại.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{fields.map((field, index) => (
								<div
									key={field.id}
									className="group relative overflow-hidden rounded-xl border border-[#dfe8df] bg-[#f9fbf8]"
								>
									<input type="hidden" {...register(`initialImages.${index}.url`)} />
									<input type="hidden" {...register(`initialImages.${index}.sortOrder`)} />

									<img
										src={field.url}
										alt={`Ảnh khu cắm trại ${index + 1}`}
										className="aspect-[4/3] w-full object-cover"
									/>

									<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-black/0 px-2 pt-6 pb-2 text-white opacity-90 transition group-hover:opacity-100">
										<div className="flex gap-1">
											{index > 0 && (
												<button
													type="button"
													aria-label={`Di chuyển ảnh ${index + 1} sang trái`}
													disabled={mediaState.isSubmitting}
													onClick={() => {
														move(index, index - 1);
													}}
													className="flex size-7 items-center justify-center rounded-full bg-white text-[#164027] shadow-sm hover:bg-[#eaf4eb] disabled:opacity-50"
												>
													<ChevronLeft className="size-3.5" />
												</button>
											)}
											{index < fields.length - 1 && (
												<button
													type="button"
													aria-label={`Di chuyển ảnh ${index + 1} sang phải`}
													disabled={mediaState.isSubmitting}
													onClick={() => {
														move(index, index + 1);
													}}
													className="flex size-7 items-center justify-center rounded-full bg-white text-[#164027] shadow-sm hover:bg-[#eaf4eb] disabled:opacity-50"
												>
													<ChevronRight className="size-3.5" />
												</button>
											)}
										</div>

										<button
											type="button"
											aria-label={`Xóa ảnh ${index + 1}`}
											disabled={mediaState.isSubmitting}
											onClick={() => remove(index)}
											className="flex size-7 items-center justify-center rounded-full bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
										>
											<Trash2 className="size-3.5" />
										</button>
									</div>

									<ErrorText message={errors.initialImages?.[index]?.url?.message} />
									<ErrorText message={errors.initialImages?.[index]?.sortOrder?.message} />
								</div>
							))}
						</div>
					)}

					<ErrorText
						message={
							errors.initialImages?.root?.message ||
							(typeof errors.initialImages?.message === "string"
								? errors.initialImages.message
								: undefined)
						}
					/>
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-3 border-t border-[#e0ebe0] px-5 py-4 bg-[#f8faf7]">
					<button
						type="button"
						onClick={onClose}
						disabled={mediaState.isSubmitting}
						className="rounded-xl border border-[#dfe8df] bg-white px-4 py-2 text-sm font-bold text-[#425048] disabled:opacity-50"
					>
						Hủy
					</button>
					<Button
						type="button"
						disabled={mediaState.isSubmitting || isUploadingImage}
						onClick={() => void submitForm()}
						className="inline-flex items-center gap-2"
					>
						{mediaState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
						<span>{mediaState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
