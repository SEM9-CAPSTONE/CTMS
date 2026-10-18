import type { PaymentStatus } from "../types";

export interface RefundStateBadgeProps {
	status: PaymentStatus | "blocked" | "awaiting_resolution";
	className?: string;
}

const BADGE_CONFIG = {
	pending: {
		label: "Đang xử lý",
		classes: "bg-amber-100 text-amber-900 border-amber-300",
	},
	succeeded: {
		label: "Đã hoàn tiền",
		classes: "bg-emerald-100 text-emerald-900 border-emerald-300",
	},
	failed: {
		label: "Thất bại (cần thử lại)",
		classes: "bg-rose-100 text-rose-900 border-rose-300",
	},
	blocked: {
		label: "Tạm giữ quyết toán",
		classes: "bg-orange-100 text-orange-900 border-orange-300",
	},
	awaiting_resolution: {
		label: "Đang chờ giải quyết khiếu nại",
		classes: "bg-sky-100 text-sky-900 border-sky-300",
	},
} as const;

export function RefundStateBadge({ status, className = "" }: RefundStateBadgeProps) {
	const config = BADGE_CONFIG[status] ?? BADGE_CONFIG.pending;

	return (
		<span
			data-testid={`refund-status-badge-${status}`}
			className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.classes} ${className}`}
		>
			{config.label}
		</span>
	);
}
