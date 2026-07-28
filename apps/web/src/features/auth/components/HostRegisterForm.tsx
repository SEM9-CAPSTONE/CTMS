import { Building, Home, Lock, Mail, MapPin, Phone, User } from "lucide-react";
import type React from "react";
import type { HostRegisterFormData } from "../types";

interface HostRegisterFormProps {
	formData: HostRegisterFormData;
	onChange: (field: keyof HostRegisterFormData, value: unknown) => void;
}

export const HostRegisterForm: React.FC<HostRegisterFormProps> = ({ formData, onChange }) => {
	return (
		<div className="space-y-3.5 text-left">
			{/* Full Name & Email */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Họ và tên chủ bãi *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<User size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Trần Văn Host"
							value={formData.fullName}
							onChange={(e) => onChange("fullName", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Email kinh doanh *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Mail size={16} className="text-[#8a9990]" />
						<input
							type="email"
							required
							placeholder="host@campsite.com"
							value={formData.email}
							onChange={(e) => onChange("email", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Campsite Name & Province */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Tên bãi cắm trại *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Home size={16} className="text-[#0284c7]" />
						<input
							type="text"
							required
							placeholder="CTMS Eco Camp Đà Lạt"
							value={formData.campsiteName}
							onChange={(e) => onChange("campsiteName", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Tỉnh / Thành phố *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<MapPin size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Lâm Đồng, Lào Cai, Sơn La..."
							value={formData.province}
							onChange={(e) => onChange("province", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Phone & Business License */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">
						Số điện thoại liên hệ *
					</label>
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
						Mã ĐKKD / Giấy phép (Tùy chọn)
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Building size={16} className="text-[#8a9990]" />
						<input
							type="text"
							placeholder="MS-429108"
							value={formData.businessLicense ?? ""}
							onChange={(e) => onChange("businessLicense", e.target.value)}
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
