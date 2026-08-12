import type { UserStatus } from "../types";

const STATUS_STYLES: Record<UserStatus, string> = {
	active: "border-emerald-200 bg-emerald-50 text-emerald-700",
	suspended: "border-red-200 bg-red-50 text-red-700",
	pending_verification: "border-amber-200 bg-amber-50 text-amber-700",
	deleted: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<UserStatus, string> = {
	active: "Đang hoạt động",
	suspended: "Đã khóa",
	pending_verification: "Chờ xác minh",
	deleted: "Đã xóa",
};

export interface AccountStatusBadgeProps {
	status: UserStatus;
}

export function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
	return (
		<span
			className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}
		>
			{STATUS_LABELS[status]}
		</span>
	);
}
