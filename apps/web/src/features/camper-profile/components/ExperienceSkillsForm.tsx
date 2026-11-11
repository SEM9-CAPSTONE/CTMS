import type { UseFormReturn } from "react-hook-form";
import type { CamperProfileFormValues } from "../schema/profile.schema";

interface ExperienceSkillsFormProps {
	form: UseFormReturn<CamperProfileFormValues>;
}

export function ExperienceSkillsForm({ form }: ExperienceSkillsFormProps) {
	const {
		register,
		formState: { errors },
	} = form;

	return (
		<div className="flex flex-col gap-6 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="border-b border-[#f0f4f1] pb-3">
				<h3 className="text-base font-extrabold text-[#164027]">Kinh nghiệm cắm trại & Trekking</h3>
				<p className="text-xs font-medium text-[#627769]">
					Thông tin hỗ trợ Host và Porter đánh giá năng lực thể chất và khả năng thám hiểm của bạn.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				{/* Camping Experience Years */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="campingExperienceYears" className="text-xs font-bold text-[#10221b]">
						Số năm kinh nghiệm cắm trại (năm)
					</label>
					<input
						id="campingExperienceYears"
						type="number"
						{...register("campingExperienceYears", { valueAsNumber: true })}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 max-w-xs"
						placeholder="Ví dụ: 5"
					/>
					{errors.campingExperienceYears && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.campingExperienceYears.message}
						</span>
					)}
				</div>

				{/* Trekking Experience Details */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="trekkingExperienceDetails" className="text-xs font-bold text-[#10221b]">
						Chi tiết kinh nghiệm trekking / leo núi
					</label>
					<textarea
						id="trekkingExperienceDetails"
						rows={3}
						{...register("trekkingExperienceDetails")}
						className="rounded-xl border border-[#dfe8df] bg-white p-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 resize-none"
						placeholder="Liệt kê các cung đường hoặc đỉnh núi bạn từng hoàn thành..."
					/>
					{errors.trekkingExperienceDetails && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.trekkingExperienceDetails.message}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
