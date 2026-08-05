import type { UseFormReturn } from "react-hook-form";
import type { CamperProfileFormValues } from "../schema/profile.schema";

interface PersonalProfileFormProps {
	form: UseFormReturn<CamperProfileFormValues>;
}

export function PersonalProfileForm({ form }: PersonalProfileFormProps) {
	const {
		register,
		formState: { errors },
	} = form;

	return (
		<div className="flex flex-col gap-6 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="border-b border-[#f0f4f1] pb-3">
				<h3 className="text-base font-extrabold text-[#164027]">Thông tin cá nhân</h3>
				<p className="text-xs font-medium text-[#627769]">
					Cập nhật chi tiết cá nhân của bạn để phục vụ việc xác thực và trải nghiệm cắm trại.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				{/* Full Name */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="fullName" className="text-xs font-bold text-[#10221b]">
						Họ và tên <span className="text-red-500">*</span>
					</label>
					<input
						id="fullName"
						type="text"
						{...register("fullName")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
						placeholder="Nhập họ và tên"
					/>
					{errors.fullName && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.fullName.message}
						</span>
					)}
				</div>

				{/* Date of Birth */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="dateOfBirth" className="text-xs font-bold text-[#10221b]">
						Ngày sinh <span className="text-red-500">*</span>
					</label>
					<input
						id="dateOfBirth"
						type="date"
						{...register("dateOfBirth")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
					/>
					{errors.dateOfBirth && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.dateOfBirth.message}
						</span>
					)}
				</div>

				{/* Gender */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="gender" className="text-xs font-bold text-[#10221b]">
						Giới tính <span className="text-red-500">*</span>
					</label>
					<select
						id="gender"
						{...register("gender")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
					>
						<option value="male">Nam</option>
						<option value="female">Nữ</option>
						<option value="other">Khác</option>
					</select>
					{errors.gender && (
						<span className="text-[11px] font-semibold text-red-500">{errors.gender.message}</span>
					)}
				</div>

				{/* Address */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="address" className="text-xs font-bold text-[#10221b]">
						Địa chỉ thường trú <span className="text-red-500">*</span>
					</label>
					<input
						id="address"
						type="text"
						{...register("address")}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
						placeholder="Nhập địa chỉ của bạn"
					/>
					{errors.address && (
						<span className="text-[11px] font-semibold text-red-500">{errors.address.message}</span>
					)}
				</div>

				{/* Bio */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="bio" className="text-xs font-bold text-[#10221b]">
						Giới thiệu ngắn (Bio)
					</label>
					<textarea
						id="bio"
						rows={3}
						{...register("bio")}
						className="rounded-xl border border-[#dfe8df] bg-white p-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 resize-none"
						placeholder="Chia sẻ ngắn gọn về đam mê cắm trại, trekking của bạn..."
					/>
					{errors.bio && (
						<span className="text-[11px] font-semibold text-red-500">{errors.bio.message}</span>
					)}
				</div>
			</div>
		</div>
	);
}
