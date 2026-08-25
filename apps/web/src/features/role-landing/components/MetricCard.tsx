import { toneClasses } from "../constants";
import type { Metric } from "../types";

export interface MetricCardProps {
	metric: Metric;
}

export function MetricCard({ metric }: MetricCardProps) {
	const Icon = metric.icon;
	return (
		<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs font-extrabold uppercase tracking-wider text-[#7b8c82]">
					{metric.label}
				</p>
				<div
					className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneClasses[metric.tone]}`}
				>
					<Icon className="size-5" />
				</div>
			</div>
			<p className="mt-4 text-3xl font-extrabold tracking-tight text-[#10221b]">{metric.value}</p>
			<p className="mt-1 text-sm font-medium text-[#667a6d]">{metric.helper}</p>
		</div>
	);
}
