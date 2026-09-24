import type { Metric } from "../types";

export interface MetricCardProps {
	metric: Metric;
}

const dotClasses: Record<Metric["tone"], string> = {
	green: "bg-emerald-500",
	blue: "bg-sky-500",
	amber: "bg-amber-500",
	red: "bg-rose-500",
	purple: "bg-purple-500",
};

export function MetricCard({ metric }: MetricCardProps) {
	return (
		<div className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm transition-all hover:border-[#164027]/30 hover:shadow-md">
			<div>
				<p className="text-xs font-extrabold uppercase tracking-wider text-[#7b8c82]">
					{metric.label}
				</p>
				<p className="mt-3 text-3xl font-extrabold tracking-tight text-[#10221b]">{metric.value}</p>
			</div>
			<div className="mt-3 flex items-center gap-2">
				<span className={`size-2 shrink-0 rounded-full ${dotClasses[metric.tone]}`} />
				<p className="text-xs font-semibold text-[#667a6d]">{metric.helper}</p>
			</div>
		</div>
	);
}
