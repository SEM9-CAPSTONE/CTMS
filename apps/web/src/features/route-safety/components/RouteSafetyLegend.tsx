import { Loader2, RefreshCw } from "lucide-react";
import { SAFETY_COLORS, WATER_COLOR, isDisplayableFeature, isMutedFeature } from "../map-symbols";
import { safetyText as t } from "../messages";
import type { LiveSafetySource, RouteSafetyResult } from "../types";
import { SafetySymbol } from "./SafetySymbol";

export interface SafetyLegendProps {
	data?: RouteSafetyResult;
	sources?: LiveSafetySource[];
	loading: boolean;
	error: boolean;
	valid: boolean;
	onRetry: () => void;
}
export function RouteSafetyLegend({ data, loading, error, valid, onRetry }: SafetyLegendProps) {
	const features = data?.features.features.filter(isDisplayableFeature) ?? [];
	return (
		<section
			data-safety-ui
			aria-label="Chú giải bản đồ"
			className="absolute right-3 bottom-3 z-20 w-56 max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-800 shadow-md"
		>
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-xs font-extrabold uppercase tracking-wide">Chú giải</h3>
				<button
					type="button"
					aria-label={t.retry}
					title={error ? "Không tải được dữ liệu. Kiểm tra lại" : t.retry}
					onClick={onRetry}
					disabled={!valid || loading}
					className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
				>
					{loading ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<RefreshCw className="size-3.5" />
					)}
				</button>
			</div>
			<div className="mt-1 flex items-center gap-2">
				<SafetySymbol kind="hazard" color={SAFETY_COLORS.HIGH} />
				<span>Điểm nguy hiểm</span>
				<SafetySymbol kind="water" color={WATER_COLOR} />
				<span>Nguồn nước</span>
			</div>
			<p className="mt-1 font-semibold">Vùng nguy hiểm</p>
			<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
				{(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const)
					.filter(
						(level) =>
							level !== "LOW" || features.some((feature) => feature.properties.severity === "LOW")
					)
					.map((level) => (
						<span key={level} className="flex items-center gap-1">
							<i
								className="size-2.5 rounded-sm border border-black/10"
								style={{ backgroundColor: SAFETY_COLORS[level] }}
							/>
							{t.severity[level]}
						</span>
					))}
			</div>
			<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
				<span className="flex items-center gap-1">
					<i className="size-2.5 rounded-full bg-slate-500" />
					Chưa rõ mức độ
				</span>
				{features.some(isMutedFeature) && <span>Màu nhạt: cũ/chưa rõ hiệu lực</span>}
			</div>
		</section>
	);
}
