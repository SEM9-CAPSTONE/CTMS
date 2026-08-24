import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ImagePlus, Loader2, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import type { CreateCampsiteError } from "../hooks/useCreateCampsite";
import {
	CREATE_CAMPSITE_DEFAULT_VALUES,
	type CreateCampsiteFormValues,
	createCampsiteFormSchema,
	toCreateCampsiteInput,
} from "../schema/create-campsite.schema";
import type { CreateCampsiteInput } from "../types";

interface CreateCampsiteFormProps {
	isSubmitting: boolean;
	error: CreateCampsiteError | null;
	onSubmit: (payload: CreateCampsiteInput) => Promise<unknown>;
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

export function CreateCampsiteForm({
	isSubmitting,
	error,
	onSubmit,
	onRetry,
}: CreateCampsiteFormProps) {
	const {
		register,
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateCampsiteFormValues>({
		resolver: zodResolver(createCampsiteFormSchema),
		defaultValues: CREATE_CAMPSITE_DEFAULT_VALUES,
		mode: "onSubmit",
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "initialImages",
	});

	const submitForm = handleSubmit(async (values) => {
		await onSubmit(toCreateCampsiteInput(values));
	});

	return (
		<form onSubmit={submitForm} className="space-y-6" noValidate>
			{error && (
				<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
					<div className="flex items-start gap-3">
						<AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />

						<div className="flex-1">
							<p className="text-sm font-bold text-red-800">Không thể tạo campsite</p>
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
				<h2 className="text-lg font-extrabold text-[#10221b]">Thông tin campsite</h2>

				<div className="mt-5 grid gap-5 md:grid-cols-2">
					<div className="md:col-span-2">
						<label htmlFor="name" className={labelClass}>
							Tên campsite *
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
							placeholder="Mô tả địa điểm, trải nghiệm và điều kiện campsite..."
							className={inputClass}
							{...register("description")}
						/>
						<ErrorText message={errors.description?.message} />
					</div>

					<div className="md:col-span-2">
						<label htmlFor="province" className={labelClass}>
							Tỉnh/Thành phố *
						</label>
						<input
							id="province"
							maxLength={100}
							disabled={isSubmitting}
							placeholder="Đà Nẵng"
							className={inputClass}
							{...register("province")}
						/>
						<ErrorText message={errors.province?.message} />
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
				<div className="flex items-center gap-2">
					<MapPin className="size-5 text-[#164027]" />
					<h2 className="text-lg font-extrabold text-[#10221b]">Tọa độ</h2>
				</div>

				<div className="mt-5 grid gap-5 md:grid-cols-2">
					<div>
						<label htmlFor="latitude" className={labelClass}>
							Vĩ độ *
						</label>
						<input
							id="latitude"
							type="number"
							step="0.000001"
							min="-90"
							max="90"
							disabled={isSubmitting}
							placeholder="11.940419"
							className={inputClass}
							{...register("latitude")}
						/>
						<ErrorText message={errors.latitude?.message} />
					</div>

					<div>
						<label htmlFor="longitude" className={labelClass}>
							Kinh độ *
						</label>
						<input
							id="longitude"
							type="number"
							step="0.000001"
							min="-180"
							max="180"
							disabled={isSubmitting}
							placeholder="108.458313"
							className={inputClass}
							{...register("longitude")}
						/>
						<ErrorText message={errors.longitude?.message} />
					</div>
				</div>
			</section>

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
							placeholder="Không đốt lửa sau 21:00. Thu gom toàn bộ rác trước khi rời campsite."
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
						<h2 className="text-lg font-extrabold text-[#10221b]">Ảnh ban đầu</h2>
						<p className="mt-1 text-sm text-[#667a6d]">Tối thiểu 1 ảnh, tối đa 10 ảnh.</p>
					</div>

					<button
						type="button"
						disabled={isSubmitting || fields.length >= 10}
						onClick={() =>
							append({
								url: "",
								displayOrder: "",
							})
						}
						className="inline-flex items-center gap-2 rounded-xl bg-[#eaf4eb] px-4 py-2.5 text-sm font-bold text-[#164027] hover:bg-[#dcebdd] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus className="size-4" />
						Thêm ảnh
					</button>
				</div>

				{fields.length === 0 ? (
					<div
						data-testid="empty-images-state"
						className="mt-5 rounded-xl border border-dashed border-[#cbd9ce] bg-[#f8faf7] px-5 py-8 text-center"
					>
						<ImagePlus className="mx-auto size-9 text-[#8fa096]" />
						<p className="mt-2 text-sm font-bold text-[#425048]">Chưa có ảnh ban đầu</p>
						<p className="mt-1 text-xs text-[#788b7e]">Nhấn “Thêm ảnh” để bổ sung ảnh campsite.</p>
					</div>
				) : (
					<div className="mt-5 space-y-3">
						{fields.map((field, index) => (
							<div
								key={field.id}
								className="grid gap-3 rounded-xl border border-[#e0ebe0] bg-[#f9fbf8] p-4 md:grid-cols-[1fr_160px_auto]"
							>
								<div>
									<label htmlFor={`image-${index}-url`} className={labelClass}>
										URL ảnh {index + 1} *
									</label>

									<input
										id={`image-${index}-url`}
										type="url"
										disabled={isSubmitting}
										placeholder="https://example.com/campsite.jpg"
										className={inputClass}
										{...register(`initialImages.${index}.url`)}
									/>

									<ErrorText message={errors.initialImages?.[index]?.url?.message} />
								</div>

								<div>
									<label htmlFor={`image-${index}-order`} className={labelClass}>
										Thứ tự ảnh {index + 1}
									</label>

									<input
										id={`image-${index}-order`}
										type="number"
										min="0"
										max="100"
										disabled={isSubmitting}
										placeholder={String(index)}
										className={inputClass}
										{...register(`initialImages.${index}.displayOrder`)}
									/>

									<ErrorText message={errors.initialImages?.[index]?.displayOrder?.message} />
								</div>

								<div className="flex items-end">
									<button
										type="button"
										aria-label={`Xóa ảnh ${index + 1}`}
										disabled={isSubmitting}
										onClick={() => remove(index)}
										className="flex size-11 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
									>
										<Trash2 className="size-4" />
									</button>
								</div>
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
							Đang tạo campsite...
						</>
					) : (
						"Tạo campsite"
					)}
				</button>
			</div>
		</form>
	);
}
