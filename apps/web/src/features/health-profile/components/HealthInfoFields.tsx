import type { UseFormReturn } from "react-hook-form";
import type { HealthProfileFormValues } from "../schema/health-profile.schema";

interface HealthInfoFieldsProps {
	form: UseFormReturn<HealthProfileFormValues>;
	disabled?: boolean;
}

export function HealthInfoFields({ form, disabled }: HealthInfoFieldsProps) {
	const {
		register,
		formState: { errors },
	} = form;

	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="border-b border-[#f0f4f1] pb-3">
				<h3 className="text-base font-extrabold text-[#164027]">Thông tin thể chất & Nhóm máu</h3>
				<p className="text-xs font-medium text-[#627769]">
					Thông tin cơ bản giúp đội ngũ cứu hộ và y tế phản ứng nhanh khi có tình huống khẩn cấp.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				{/* Blood Type */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="bloodType" className="text-xs font-bold text-[#10221b]">
						Nhóm máu <span className="text-red-500">*</span>
					</label>
					<select
						id="bloodType"
						disabled={disabled}
						{...register("bloodType")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs font-semibold text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						<option value="UNKNOWN">Chưa xác định</option>
						<option value="A+">A+</option>
						<option value="A-">A-</option>
						<option value="B+">B+</option>
						<option value="B-">B-</option>
						<option value="AB+">AB+</option>
						<option value="AB-">AB-</option>
						<option value="O+">O+ (Phổ biến)</option>
						<option value="O-">O- (Chuyên cho)</option>
					</select>
					{errors.bloodType && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.bloodType.message}
						</span>
					)}
				</div>

				{/* Physical Fitness Level */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="physicalFitnessLevel" className="text-xs font-bold text-[#10221b]">
						Trình độ thể lực / Leo núi <span className="text-red-500">*</span>
					</label>
					<select
						id="physicalFitnessLevel"
						disabled={disabled}
						{...register("physicalFitnessLevel")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs font-semibold text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						<option value="BEGINNER">Mới bắt đầu (Chưa trekking nhiều)</option>
						<option value="INTERMEDIATE">Trung bình (Đã đi 2-5 cung đường)</option>
						<option value="ADVANCED">Nâng cao (Trekking đèo dốc thường xuyên)</option>
						<option value="EXPERT">Chuyên gia (Chinh phục các đỉnh khắc nghiệt)</option>
					</select>
					{errors.physicalFitnessLevel && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.physicalFitnessLevel.message}
						</span>
					)}
				</div>

				{/* Dietary Restrictions */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="dietaryRestrictions" className="text-xs font-bold text-[#10221b]">
						Chế độ ăn kiêng / Kiêng khem
					</label>
					<input
						id="dietaryRestrictions"
						type="text"
						disabled={disabled}
						{...register("dietaryRestrictions")}
						placeholder="Ví dụ: Ăn chay, không ăn cay, dị ứng lactose..."
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
					{errors.dietaryRestrictions && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.dietaryRestrictions.message}
						</span>
					)}
				</div>

				{/* Emergency Notes */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="emergencyNotes" className="text-xs font-bold text-[#10221b]">
						Lưu ý y tế quan trọng / Hướng dẫn khẩn cấp
					</label>
					<textarea
						id="emergencyNotes"
						rows={3}
						disabled={disabled}
						{...register("emergencyNotes")}
						placeholder="Ghi chú quan trọng cho Porter/Host khi có cấp cứu (ví dụ: Vị trí để thuốc cá nhân trong balo, tiền sử huyết áp...)"
						className="rounded-xl border border-[#dfe8df] bg-white p-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
					{errors.emergencyNotes && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.emergencyNotes.message}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
