import type { ReactNode } from "react";

export type StatusBadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_STYLES: Record<StatusBadgeTone, string> = {
	success: "border-emerald-200 bg-emerald-50 text-emerald-700",
	danger: "border-red-200 bg-red-50 text-red-700",
	warning: "border-amber-200 bg-amber-50 text-amber-700",
	info: "border-sky-200 bg-sky-50 text-sky-700",
	neutral: "border-slate-200 bg-slate-100 text-slate-600",
};

export interface StatusBadgeProps {
	tone: StatusBadgeTone;
	children: ReactNode;
	icon?: ReactNode;
}

/** Pill badge for workflow statuses; same look as the account status badge. */
export function StatusBadge({ tone, children, icon }: StatusBadgeProps) {
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${TONE_STYLES[tone]}`}
		>
			{icon}
			{children}
		</span>
	);
}
