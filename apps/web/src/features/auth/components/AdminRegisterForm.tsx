import { Key, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react";
import type React from "react";
import type { AdminRegisterFormData } from "../types";

interface AdminRegisterFormProps {
	formData: AdminRegisterFormData;
	onChange: (field: keyof AdminRegisterFormData, value: unknown) => void;
}

export const AdminRegisterForm: React.FC<AdminRegisterFormProps> = ({ formData, onChange }) => {
	return (
		<div className="space-y-3.5 text-left">
			{/* Admin Warning Banner */}
			<div className="flex items-center gap-2 rounded-xl bg-purple-50 p-3 text-xs font-semibold text-purple-900 border border-purple-200">
				<ShieldCheck size={18} className="shrink-0 text-purple-700" />
				<span>
					Đăng ký tài khoản Quản trị viên yêu cầu Mã bảo mật Admin được cấp bởi hệ thống CTMS.
				</span>
			</div>

			{/* Full Name & Email */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Họ và tên Admin *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<User size={16} className="text-[#8a9990]" />
						<input
							type="text"
							required
							placeholder="Nguyễn Admin"
							value={formData.fullName}
							onChange={(e) => onChange("fullName", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>

				<div>
					<label className="mb-1 block text-xs font-bold text-[#425048]">Email hệ thống *</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm focus-within:border-[#164027]">
						<Mail size={16} className="text-[#8a9990]" />
						<input
							type="email"
							required
							placeholder="admin@ctms.vn"
							value={formData.email}
							onChange={(e) => onChange("email", e.target.value)}
							className="w-full bg-transparent outline-none text-[#10221b]"
						/>
					</div>
				</div>
			</div>

			{/* Phone & Admin Secret Key */}
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
					<label className="mb-1 block text-xs font-bold text-purple-900">
						Mã bí mật Admin (Admin Passcode) *
					</label>
					<div className="flex items-center gap-2.5 rounded-xl border border-purple-300 bg-purple-50/50 px-3.5 py-2.5 text-sm shadow-sm focus-within:border-purple-600">
						<Key size={16} className="text-purple-600" />
						<input
							type="password"
							required
							placeholder="Mã kích hoạt Admin"
							value={formData.adminSecretKey}
							onChange={(e) => onChange("adminSecretKey", e.target.value)}
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
