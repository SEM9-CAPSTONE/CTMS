import { Award, Compass, Lock, Mail, Phone, User } from "lucide-react";
import type React from "react";
import type { PorterRegisterFormData } from "../types";

interface PorterRegisterFormProps {
	formData: PorterRegisterFormData;
	onChange: (field: keyof PorterRegisterFormData, value: unknown) => void;
}

export const PorterRegisterForm: React.FC<PorterRegisterFormProps> = ({ formData, onChange }) => {
	return (
		<div className="space-y-3.5 text-left">
			{/* Full Name & Email */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Họ và tên Porter *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<User size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Lý A Porter"
							value={formData.fullName}
							onChange={(e) => onChange("fullName", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Email liên hệ *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Mail size={16} className="text-[#8a9990]" />
						<input
							type="email"
							required
							placeholder="porter@example.com"
							value={formData.email}
							onChange={(e) => onChange("email", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Experience Years & Operating Areas */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						Số năm kinh nghiệm *
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Award size={16} className="text-[#2563eb]" />
						<input
							type="number"
							min="0"
							required
							placeholder="3"
							value={formData.experienceYears || ""}
							onChange={(e) => onChange("experienceYears", Number(e.target.value))}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						Khu vực núi hoạt động chính *
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Compass size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Tà Xùa, Fansipan, Nhìu Cồ San..."
							value={formData.operatingAreas}
							onChange={(e) => onChange("operatingAreas", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Phone & Certification/Invite Code */}
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
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						Mã mời / Thẻ chứng chỉ Porter
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Award size={16} className="text-[#8a9990]" />
						<input
							type="text"
							placeholder="PTR-8821"
							value={formData.certificationCode ?? ""}
							onChange={(e) => onChange("certificationCode", e.target.value)}
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
