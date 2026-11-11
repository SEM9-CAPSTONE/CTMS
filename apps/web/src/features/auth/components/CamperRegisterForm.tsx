import { Activity, Heart, Lock, Mail, Phone, User } from "lucide-react";
import type React from "react";
import type { CamperRegisterFormData } from "../types";
import { isValidEmail, isValidPhoneNumber } from "../utils/auth.utils";

interface CamperRegisterFormProps {
	formData: CamperRegisterFormData;
	onChange: (field: keyof CamperRegisterFormData, value: unknown) => void;
}

export const CamperRegisterForm: React.FC<CamperRegisterFormProps> = ({ formData, onChange }) => {
	// Email and phone are both required (business flow update) — format still
	// checked with the existing utils.
	const emailError =
		formData.email && !isValidEmail(formData.email) ? "Email không đúng định dạng" : null;
	const phoneError =
		formData.phone && !isValidPhoneNumber(formData.phone)
			? "Số điện thoại không đúng định dạng (VD: 0912345678)"
			: null;

	return (
		<div className="space-y-3.5 text-left">
			{/* Full Name & Email */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Họ và tên *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<User size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Nguyễn Văn A"
							value={formData.fullName}
							onChange={(e) => onChange("fullName", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Email *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Mail size={16} className="text-[#8a9990]" />
						<input
							type="email"
							required
							placeholder="camper@example.com"
							value={formData.email}
							onChange={(e) => onChange("email", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
					{emailError && <p className="mt-1 text-xs font-semibold text-red-600">{emailError}</p>}
				</div>
			</div>

			{/* Phone & Blood Type */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Số điện thoại *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Phone size={16} className="text-[#8a9990]" />
						<input
							type="tel"
							required
							placeholder="0912345678"
							value={formData.phone}
							onChange={(e) => onChange("phone", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
					{phoneError && <p className="mt-1 text-xs font-semibold text-red-600">{phoneError}</p>}
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						Nhóm máu (Safety Profile)
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Heart size={16} className="text-[#8a9990]" />
						<select
							value={formData.bloodType ?? "O"}
							onChange={(e) => onChange("bloodType", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						>
							<option value="O">Nhóm O</option>
							<option value="A">Nhóm A</option>
							<option value="B">Nhóm B</option>
							<option value="AB">Nhóm AB</option>
						</select>
					</div>
				</div>
			</div>

			{/* Fitness Level & Emergency Contact */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Thể lực trekking</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Activity size={16} className="text-[#8a9990]" />
						<select
							value={formData.fitnessLevel ?? "MEDIUM"}
							onChange={(e) => onChange("fitnessLevel", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						>
							<option value="BEGINNER">Mới bắt đầu (Cơ bản)</option>
							<option value="MEDIUM">Trung bình (Trekking nhẹ)</option>
							<option value="ADVANCED">Nâng cao (Leo núi nhiều ngày)</option>
						</select>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						SĐT Người thân khẩn cấp
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Phone size={16} className="text-[#8a9990]" />
						<input
							type="tel"
							placeholder="0987654321"
							value={formData.emergencyContactPhone ?? ""}
							onChange={(e) => onChange("emergencyContactPhone", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Password & Confirm Password */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Mật khẩu *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Lock size={16} className="text-[#8a9990]" />
						<input
							type="password"
							required
							placeholder="••••••••"
							value={formData.password}
							onChange={(e) => onChange("password", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Xác nhận mật khẩu *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Lock size={16} className="text-[#8a9990]" />
						<input
							type="password"
							required
							placeholder="••••••••"
							value={formData.confirmPassword}
							onChange={(e) => onChange("confirmPassword", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
