import { AlertCircle, Check, Loader2, RotateCcw, Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { AVAILABILITY_STATUS_LABELS, MAX_CERTIFICATIONS, MAX_LANGUAGES } from "../constants";
import type { PorterProfileFormValues } from "../schema/porter-profile.schema";
import type { PorterAvailabilityStatus } from "../types";
import { TagListInput } from "./TagListInput";

interface PorterProfileFormProps {
	form: UseFormReturn<PorterProfileFormValues>;
	isSaving: boolean;
	onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
	onReset: () => void;
	isDirty: boolean;
}

export function PorterProfileForm({
	form,
	isSaving,
	onSubmit,
	onReset,
	isDirty,
}: PorterProfileFormProps) {
	const {
		register,
		watch,
		setValue,
		formState: { errors },
	} = form;

	const certifications = watch("certifications") || [];
	const languages = watch("languages") || [];
	const availabilityStatus = watch("availabilityStatus");

	return (
		<form
			onSubmit={onSubmit}
			data-testid="porter-profile-form"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm sm:p-8"
		>
			<div className="border-b border-[#e7eee7] pb-4">
				<h2 className="text-lg font-extrabold text-[#10221b]">Thông tin hồ sơ chuyên môn</h2>
				<p className="mt-0.5 text-xs text-[#627769]">
					Cập nhật kinh nghiệm thực địa, chứng chỉ kỹ năng và ngôn ngữ giao tiếp.
				</p>
			</div>

			<div className="mt-6 flex flex-col gap-6">
				{/* Experience Years */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="experienceYears"
						className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]"
					>
						Số năm kinh nghiệm Porter *
					</label>
					<div className="max-w-xs">
						<input
							id="experienceYears"
							type="number"
							min={0}
							step={1}
							disabled={isSaving}
							{...register("experienceYears", { valueAsNumber: true })}
							placeholder="VD: 3"
							className="w-full rounded-xl border border-[#d2ded2] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027] disabled:bg-[#f4f7f2]"
						/>
					</div>
					{errors.experienceYears && (
						<div
							data-testid="experienceYears-error"
							className="flex items-center gap-1.5 text-xs font-bold text-red-600"
						>
							<AlertCircle size={14} className="shrink-0" />
							<span>{errors.experienceYears.message}</span>
						</div>
					)}
					<p className="text-[11px] text-[#627769]">
						Số năm kinh nghiệm thực địa hỗ trợ hoặc dẫn đường leo núi (tối thiểu 0 năm).
					</p>
				</div>

				{/* Availability Status */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="availabilityStatus"
						className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]"
					>
						Trạng thái sẵn sàng nhận ca *
					</label>
					<div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
						{(["available", "unavailable"] as PorterAvailabilityStatus[]).map((status) => {
							const isSelected = availabilityStatus === status;
							return (
								<button
									key={status}
									type="button"
									disabled={isSaving}
									onClick={() =>
										setValue("availabilityStatus", status, {
											shouldDirty: true,
											shouldValidate: true,
										})
									}
									className={`flex items-center justify-between rounded-xl border p-3.5 text-left text-xs font-bold transition ${
										isSelected
											? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-1 ring-[#164027]"
											: "border-[#d2ded2] bg-white text-[#4a5e51] hover:bg-[#f8faf7]"
									}`}
								>
									<span>{AVAILABILITY_STATUS_LABELS[status]}</span>
									{isSelected && <Check size={16} className="text-[#164027]" />}
								</button>
							);
						})}
					</div>
					{errors.availabilityStatus && (
						<div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
							<AlertCircle size={14} className="shrink-0" />
							<span>{errors.availabilityStatus.message}</span>
						</div>
					)}
				</div>

				{/* Certifications List */}
				<TagListInput
					id="certifications-input"
					label="Chứng chỉ chuyên môn & Kỹ năng"
					placeholder="VD: Sơ cấp cứu WFA, Hướng dẫn viên địa phương, Cứu hộ rừng núi..."
					tags={certifications}
					onChange={(next) =>
						setValue("certifications", next, {
							shouldDirty: true,
							shouldValidate: true,
						})
					}
					maxItems={MAX_CERTIFICATIONS}
					disabled={isSaving}
					error={errors.certifications?.message}
					helperText="Tối đa 20 chứng chỉ, tối đa 100 ký tự mỗi mục. Nhấn Enter hoặc nút Thêm."
				/>

				{/* Languages List */}
				<TagListInput
					id="languages-input"
					label="Ngôn ngữ giao tiếp"
					placeholder="VD: Tiếng Việt, Tiếng Anh, Tiếng Tày, Tiếng H'Mông..."
					tags={languages}
					onChange={(next) =>
						setValue("languages", next, {
							shouldDirty: true,
							shouldValidate: true,
						})
					}
					maxItems={MAX_LANGUAGES}
					disabled={isSaving}
					error={errors.languages?.message}
					helperText="Tối đa 20 ngôn ngữ, tối đa 100 ký tự mỗi mục. Nhấn Enter hoặc nút Thêm."
				/>
			</div>

			{/* Action buttons */}
			<div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[#e7eee7] pt-5">
				{isDirty && (
					<button
						type="button"
						disabled={isSaving}
						onClick={onReset}
						className="flex items-center gap-1.5 rounded-xl border border-[#d2ded2] px-4 py-2.5 text-xs font-bold text-[#55685a] transition hover:bg-[#f4f7f2]"
					>
						<RotateCcw size={15} />
						<span>Hủy thay đổi</span>
					</button>
				)}

				<button
					type="submit"
					disabled={isSaving}
					data-testid="save-porter-profile-button"
					className="flex items-center gap-2 rounded-xl bg-[#164027] px-6 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#205234] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSaving ? (
						<>
							<Loader2 size={16} className="animate-spin" />
							<span>Đang lưu hồ sơ...</span>
						</>
					) : (
						<>
							<Save size={16} />
							<span>Lưu hồ sơ Porter</span>
						</>
					)}
				</button>
			</div>
		</form>
	);
}
