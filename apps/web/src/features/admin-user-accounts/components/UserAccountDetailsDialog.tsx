import { CalendarDays, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import type { UserAccountDetail } from "../types";
import { AccountStatusBadge } from "./AccountStatusBadge";

export interface UserAccountDetailsDialogProps {
	open: boolean;
	user: UserAccountDetail | null;
	isLoading: boolean;
	onClose: () => void;
}

export function UserAccountDetailsDialog({
	open,
	user,
	isLoading,
	onClose,
}: UserAccountDetailsDialogProps) {
	if (!open) return null;
	return (
		<dialog
			open
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/50 p-4"
			aria-labelledby="user-detail-title"
		>
			<div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-6 py-4">
					<h2 id="user-detail-title" className="text-xl font-extrabold text-[#10221b]">
						Chi tiết tài khoản
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng chi tiết"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2]"
					>
						<X className="size-5" />
					</button>
				</div>
				{isLoading || !user ? (
					<div className="flex items-center justify-center gap-3 p-12 text-sm font-semibold text-[#54655a]">
						<div className="size-5 animate-spin rounded-full border-2 border-[#164027] border-t-transparent" />{" "}
						Đang tải chi tiết...
					</div>
				) : (
					<div className="space-y-6 p-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-2xl font-extrabold text-[#10221b]">
									{user.fullName || "Chưa cập nhật họ tên"}
								</p>
								<p className="mt-1 text-xs text-[#788c7e]">{user.id}</p>
							</div>
							<AccountStatusBadge status={user.status} />
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<DetailItem icon={Mail} label="Email" value={user.email || "Chưa cập nhật"} />
							<DetailItem
								icon={Phone}
								label="Số điện thoại"
								value={user.phone || "Chưa cập nhật"}
							/>
							<DetailItem icon={UserRound} label="Vai trò" value={user.role.toUpperCase()} />
							<DetailItem
								icon={CalendarDays}
								label="Ngày sinh"
								value={user.dateOfBirth || "Chưa cập nhật"}
							/>
							<DetailItem icon={MapPin} label="Địa chỉ" value={user.address || "Chưa cập nhật"} />
							<DetailItem
								icon={CalendarDays}
								label="Ngày tạo"
								value={new Date(user.createdAt).toLocaleString("vi-VN")}
							/>
						</div>
						<div className="rounded-xl bg-[#f4f7f2] p-4">
							<p className="text-xs font-bold uppercase tracking-wide text-[#667a6d]">Giới thiệu</p>
							<p className="mt-2 text-sm text-[#425048]">{user.bio || "Chưa cập nhật"}</p>
						</div>
					</div>
				)}
			</div>
		</dialog>
	);
}

interface DetailItemProps {
	icon: typeof Mail;
	label: string;
	value: string;
}
function DetailItem({ icon: Icon, label, value }: DetailItemProps) {
	return (
		<div className="rounded-xl border border-[#e0ebe0] p-4">
			<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#667a6d]">
				<Icon className="size-4" />
				{label}
			</div>
			<p className="mt-2 break-words text-sm font-semibold text-[#10221b]">{value}</p>
		</div>
	);
}
