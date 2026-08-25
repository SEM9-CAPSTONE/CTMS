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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { VIETNAM_PROVINCES } from "../constants";
import type { CreateCampsiteError } from "../hooks/useCreateCampsite";
import {
	CREATE_CAMPSITE_DEFAULT_VALUES,
	type CreateCampsiteFormValues,
	clearCreateCampsiteDraft,
	createCampsiteFormSchema,
	loadCreateCampsiteDraft,
	saveCreateCampsiteDraft,
	toCreateCampsiteInput,
} from "../schema/create-campsite.schema";
import { campsitesService } from "../services/campsites.service";
import type { CreateCampsiteInput } from "../types";
import { CampsiteLocationPicker } from "./CampsiteLocationPicker";

interface CreateCampsiteFormProps {
	isSubmitting: boolean;
	error: CreateCampsiteError | null;
	mode?: "create" | "edit";
	initialValues?: CreateCampsiteFormValues;
	onSubmit: (payload: CreateCampsiteInput, values: CreateCampsiteFormValues) => Promise<unknown>;
	onRetry?: () => Promise<unknown>;
}

function ErrorText({ message }: { message?: string }) {
	if (!message) {
		return null;
	}

	return <p className="mt-1 text-xs font-semibold text-red-600">{message}</p>;
}

const inputClass =
	"mt-1.5 w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-3 text-sm text-[#10221b] outline-none transition placeholder:text-[#9aaba0] focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-gray-50";

const labelClass = "text-sm font-bold text-[#34483b]";

function toCoordinateFormValue(value: number | null): string {
	return value === null ? "" : String(Number(value.toFixed(6)));
}

export function CreateCampsiteForm({
	isSubmitting,
	error,
	mode = "create",
	initialValues,
	onSubmit,
	onRetry,
}: CreateCampsiteFormProps) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const [uploadError, setUploadError] = useState("");
	const defaultValues = useMemo(() => initialValues ?? loadCreateCampsiteDraft(), [initialValues]);
	const isEditMode = mode === "edit";
	const {
		register,
		control,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<CreateCampsiteFormValues>({
		resolver: zodResolver(createCampsiteFormSchema),
		defaultValues,
		mode: "onSubmit",
	});

	const { fields, append, remove, move } = useFieldArray({
		control,
		name: "initialImages",
	});
	const province = watch("province");
	const placeLabel = watch("placeLabel");
	const latitude = watch("latitude");
	const longitude = watch("longitude");

	const submitForm = handleSubmit(async (values) => {
		const created = await onSubmit(toCreateCampsiteInput(values), values);

		if (created && !isEditMode) {
			clearCreateCampsiteDraft();
		}
	});

	useEffect(() => {
		if (isEditMode) {
			return undefined;
		}

		const subscription = watch((values) => {
			saveCreateCampsiteDraft({
				...CREATE_CAMPSITE_DEFAULT_VALUES,
				...values,
				initialImages: values.initialImages ?? [],
			} as CreateCampsiteFormValues);
		});

		return () => subscription.unsubscribe();
	}, [isEditMode, watch]);

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

	return (
		<form onSubmit={submitForm} className="space-y-6" noValidate>
			{error && (
				<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
					<div className="flex items-start gap-3">
						<AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />

						<div className="flex-1">
							<p className="text-sm font-bold text-red-800">
								{isEditMode ? "Không thể cập nhật khu cắm trại" : "Không thể tạo khu cắm trại"}
							</p>
							<p className="mt-1 text-sm text-red-700">{error.message}</p>

							{error.canRetry && onRetry && (
								<button
									type="button"
									disabled={isSubmitting}
									onClick={() => void onRetry()}
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

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
				<h2 className="text-lg font-extrabold text-[#10221b]">Thông tin khu cắm trại</h2>

				<div className="mt-5 grid gap-5 md:grid-cols-2">
					<div className="md:col-span-2">
						<label htmlFor="name" className={labelClass}>
							Tên khu cắm trại *
						</label>
						<input
							id="name"
							maxLength={150}
							disabled={isSubmitting}
							placeholder="Da Lat Pine Camp"
							className={inputClass}
							{...register("name")}
						/>
						<ErrorText message={errors.name?.message} />
					</div>

					<div className="md:col-span-2">
						<label htmlFor="description" className={labelClass}>
							Mô tả *
						</label>
						<textarea
							id="description"
							rows={4}
							maxLength={2000}
							disabled={isSubmitting}
							placeholder="Mô tả địa điểm, trải nghiệm và điều kiện khu cắm trại..."
							className={inputClass}
							{...register("description")}
						/>
						<ErrorText message={errors.description?.message} />
					</div>

					<div className="md:col-span-2">
						<label htmlFor="province" className={labelClass}>
							Tỉnh/Thành phố *
						</label>
						<select
							id="province"
							disabled={isSubmitting}
							className={inputClass}
							{...register("province")}
						>
							<option value="">Chọn tỉnh/thành phố</option>
							{VIETNAM_PROVINCES.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
						<ErrorText message={errors.province?.message} />
					</div>
				</div>
			</section>

			<input type="hidden" {...register("placeLabel")} />
			<input type="hidden" {...register("latitude")} />
			<input type="hidden" {...register("longitude")} />

			<CampsiteLocationPicker
				province={province}
				value={{
					placeLabel,
					latitude: latitude === "" ? null : Number(latitude),
					longitude: longitude === "" ? null : Number(longitude),
				}}
				disabled={isSubmitting}
				errors={{
					placeLabel: errors.placeLabel?.message,
					latitude: errors.latitude?.message,
					longitude: errors.longitude?.message,
				}}
				onChange={(location) => {
					setValue("placeLabel", location.placeLabel, {
						shouldDirty: true,
						shouldValidate: true,
					});
					setValue("latitude", toCoordinateFormValue(location.latitude), {
						shouldDirty: true,
						shouldValidate: true,
					});
					setValue("longitude", toCoordinateFormValue(location.longitude), {
						shouldDirty: true,
						shouldValidate: true,
					});
				}}
				onProvinceChange={(nextProvince) => {
					setValue("province", nextProvince, {
						shouldDirty: true,
						shouldValidate: true,
					});
				}}
			/>

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
				<h2 className="text-lg font-extrabold text-[#10221b]">Chính sách & giờ hoạt động</h2>

				<div className="mt-5 space-y-5">
					<div>
						<label htmlFor="policies" className={labelClass}>
							Chính sách *
						</label>
						<textarea
							id="policies"
							rows={4}
							maxLength={2000}
							disabled={isSubmitting}
							placeholder="Không đốt lửa sau 21:00. Thu gom toàn bộ rác trước khi rời khu cắm trại."
							className={inputClass}
							{...register("policies")}
						/>
						<ErrorText message={errors.policies?.message} />
					</div>

					<div className="grid gap-5 md:grid-cols-2">
						<div>
							<label htmlFor="opensAt" className={labelClass}>
								Giờ mở cửa *
							</label>
							<input
								id="opensAt"
								type="time"
								disabled={isSubmitting}
								className={inputClass}
								{...register("opensAt")}
							/>
							<ErrorText message={errors.opensAt?.message} />
						</div>

						<div>
							<label htmlFor="closesAt" className={labelClass}>
								Giờ đóng cửa *
							</label>
							<input
								id="closesAt"
								type="time"
								disabled={isSubmitting}
								className={inputClass}
								{...register("closesAt")}
							/>
							<ErrorText message={errors.closesAt?.message} />
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-extrabold text-[#10221b]">
							{isEditMode ? "Ảnh khu cắm trại" : "Ảnh ban đầu"}
						</h2>
						<p className="mt-1 text-sm text-[#667a6d]">Tối thiểu 1 ảnh, tối đa 10 ảnh.</p>
					</div>

					<button
						type="button"
						disabled={isSubmitting || isUploadingImage || fields.length >= 10}
						onClick={() => fileInputRef.current?.click()}
						className="inline-flex items-center gap-2 rounded-xl bg-[#eaf4eb] px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#dcebdd] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isUploadingImage ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
						{isUploadingImage ? "Đang tải ảnh..." : "Thêm ảnh"}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						aria-label="Chọn ảnh từ thiết bị"
						className="sr-only"
						disabled={isSubmitting || isUploadingImage || fields.length >= 10}
						onChange={(event) => void uploadImages(event.target.files)}
					/>
				</div>

				{uploadError && <p className="mt-3 text-sm font-semibold text-red-600">{uploadError}</p>}

				{fields.length === 0 ? (
					<div
						data-testid="empty-images-state"
						className="mt-5 rounded-xl border border-dashed border-[#cbd9ce] bg-[#f8faf7] px-5 py-8 text-center"
					>
						<ImagePlus className="mx-auto size-9 text-[#8fa096]" />
						<p className="mt-2 text-sm font-bold text-[#425048]">Chưa có ảnh ban đầu</p>
						<p className="mt-1 text-xs text-[#788b7e]">
							Nhấn “Thêm ảnh” để bổ sung ảnh khu cắm trại.
						</p>
					</div>
				) : (
					<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

								<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-black/0 px-2.5 pt-8 pb-2 text-white">
									<div className="flex gap-1.5">
										{index > 0 && (
											<button
												type="button"
												aria-label={`Di chuyển ảnh ${index + 1} sang trái`}
												disabled={isSubmitting}
												onClick={() => {
													move(index, index - 1);
												}}
												className="flex size-8 items-center justify-center rounded-full bg-white text-[#164027] shadow-sm hover:bg-[#eaf4eb] disabled:opacity-50"
											>
												<ChevronLeft className="size-4" />
											</button>
										)}
										{index < fields.length - 1 && (
											<button
												type="button"
												aria-label={`Di chuyển ảnh ${index + 1} sang phải`}
												disabled={isSubmitting}
												onClick={() => {
													move(index, index + 1);
												}}
												className="flex size-8 items-center justify-center rounded-full bg-white text-[#164027] shadow-sm hover:bg-[#eaf4eb] disabled:opacity-50"
											>
												<ChevronRight className="size-4" />
											</button>
										)}
									</div>

									<button
										type="button"
										aria-label={`Xóa ảnh ${index + 1}`}
										disabled={isSubmitting}
										onClick={() => remove(index)}
										className="flex size-8 items-center justify-center rounded-full bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
									>
										<Trash2 className="size-4" />
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
						typeof errors.initialImages?.message === "string"
							? errors.initialImages.message
							: undefined
					}
				/>
			</section>

			<div className="flex justify-end">
				<button
					type="submit"
					disabled={isSubmitting}
					className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-[#164027] px-6 py-3.5 text-sm font-extrabold text-white shadow-sm hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							{isEditMode ? "Đang cập nhật khu cắm trại..." : "Đang tạo khu cắm trại..."}
						</>
					) : isEditMode ? (
						"Lưu thay đổi"
					) : (
						"Tạo khu cắm trại"
					)}
				</button>
			</div>
		</form>
	);
}
