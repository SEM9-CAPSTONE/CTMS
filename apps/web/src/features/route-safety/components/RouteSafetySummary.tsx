import { AlertTriangle } from "lucide-react";
import { SAFETY_COLORS, WATER_COLOR, isDisplayableFeature } from "../map-symbols";
import type { LiveSafetySource, SafetyCollection } from "../types";
import { SafetySymbol } from "./SafetySymbol";

export function RouteSafetySummary({
	data,
	sources,
}: { data?: SafetyCollection; sources?: LiveSafetySource[] }) {
	const features = data?.features.filter(isDisplayableFeature) ?? [];
	const active = features.filter(
		(feature) =>
			feature.properties.lifecycleStatus === "ACTIVE" &&
			feature.properties.sourceType !== "RESOURCE"
	);
	const areas = active.filter((feature) =>
		["Polygon", "MultiPolygon"].includes(feature.geometry.type)
	);
	const counts = [
		areas.filter((feature) => feature.properties.severity === "MEDIUM").length,
		areas.filter((feature) => feature.properties.severity === "HIGH").length,
		areas.filter((feature) => feature.properties.severity === "VERY_HIGH").length,
		active.filter((feature) => !["Polygon", "MultiPolygon"].includes(feature.geometry.type)).length,
		features.filter((feature) => feature.properties.sourceType === "RESOURCE").length,
	];
	const cards = [
		{
			label: "Vùng nguy hiểm",
			detail: "Mức trung bình",
			color: SAFETY_COLORS.MEDIUM,
			background: "bg-amber-50",
			provider: "NCHMF",
		},
		{
			label: "Vùng nguy hiểm",
			detail: "Mức cao",
			color: SAFETY_COLORS.HIGH,
			background: "bg-orange-50",
			provider: "NCHMF",
		},
		{
			label: "Vùng nguy hiểm",
			detail: "Mức rất cao",
			color: SAFETY_COLORS.VERY_HIGH,
			background: "bg-red-50",
			provider: "NCHMF",
		},
		{
			label: "Vị trí nguy hiểm",
			detail: "",
			color: SAFETY_COLORS.UNKNOWN,
			background: "bg-slate-50",
			provider: "VNDMS",
		},
		{
			label: "Nguồn nước",
			detail: "",
			color: WATER_COLOR,
			background: "bg-sky-50",
			provider: "OSM",
		},
	];
	return (
		<section
			aria-label="Cảnh báo quanh tuyến"
			className="mt-4 rounded-xl border border-[#e4e9e5] bg-white p-3 shadow-sm sm:p-4"
		>
			<h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-[#10221b]">
				<AlertTriangle className="size-5 text-orange-600" />
				Cảnh báo quanh tuyến
			</h3>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
				{cards.map((card, index) => {
					const source = sources?.find((item) => item.source === card.provider);
					const ready = source?.status === "LIVE" || source?.status === "EMPTY";
					const count = counts[index] > 0 || ready ? counts[index] : "—";
					return (
						<div
							key={card.label + card.detail}
							title="Số lượng trong dữ liệu hiện có quanh tuyến"
							className={`min-w-0 rounded-xl p-3 ${card.background}`}
						>
							<div className="flex items-center gap-2">
								<SafetySymbol kind={index === 4 ? "water" : "hazard"} color={card.color} />
								<strong className="text-xl font-extrabold text-[#10221b]">{count}</strong>
							</div>
							<p className="mt-1 text-xs font-semibold text-[#34483b]">{card.label}</p>
							{card.detail && <p className="mt-1 text-[10px] text-[#667a6d]">{card.detail}</p>}
						</div>
					);
				})}
			</div>
		</section>
	);
}
