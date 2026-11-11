import type { RouteStatus } from "../types";
import { statusLabels } from "../utils/route-presentation";

const colors: Record<RouteStatus, string> = {
	draft: "border-slate-200 bg-slate-50 text-slate-700",
	pending_approval: "border-amber-200 bg-amber-50 text-amber-800",
	active: "border-emerald-200 bg-emerald-50 text-emerald-900",
	closed: "border-zinc-200 bg-zinc-100 text-zinc-600",
};
export function RouteStatusBadge({ status }: { status: RouteStatus }) {
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${colors[status]}`}
		>
			{statusLabels[status]}
		</span>
	);
}
