import { AlertTriangle } from "lucide-react";
import { SAFETY_COLORS, WATER_COLOR, isDisplayableFeature } from "../map-symbols";
import type { SafetyCollection } from "../types";
import { countConnectedWaterways } from "../utils/count-connected-waterways";
import { uniqueWarningAreas } from "../utils/unique-warning-areas";
import { SafetySymbol } from "./SafetySymbol";

export function RouteSafetySummary({ data }: { data?: SafetyCollection }) {
	const features = data?.features.filter(isDisplayableFeature) ?? [];
	const active = features.filter(
		(feature) =>
			feature.properties.lifecycleStatus === "ACTIVE" &&
			feature.properties.sourceType !== "RESOURCE"
	);
	const areas = uniqueWarningAreas(active);
	const water = features.filter((feature) => feature.properties.sourceType === "RESOURCE");
	const waterPoints = water.filter((feature) => feature.geometry.type === "Point").length;
	const waterways = countConnectedWaterways(water);
	const waterDetail = [
		waterPoints > 0 ? `${waterPoints} điểm nguồn nước` : "",
		waterways > 0 ? `${waterways} cụm sông, suối` : "",
	]
		.filter(Boolean)
		.join(" · ");
	const counts = [
		areas.filter((feature) => feature.properties.severity === "MEDIUM").length,
		areas.filter((feature) => feature.properties.severity === "HIGH").length,
		areas.filter((feature) => feature.properties.severity === "VERY_HIGH").length,
		active.filter((feature) => !["Polygon", "MultiPolygon"].includes(feature.geometry.type)).length,
		waterPoints + waterways,
	];
	const cards = [
		{
			label: "",
			detail: "Mức trung bình",
			color: SAFETY_COLORS.MEDIUM,
			background: "bg-amber-50",
		},
		{
			label: "",
			detail: "Mức cao",
			color: SAFETY_COLORS.HIGH,
			background: "bg-red-50",
		},
		{
			label: "",
			detail: "Mức rất cao",
			color: SAFETY_COLORS.VERY_HIGH,
			background: "bg-fuchsia-50",
		},
		{
			label: "Vị trí nguy hiểm",
			detail: "",
			color: SAFETY_COLORS.UNKNOWN,
			background: "bg-slate-50",
		},
		{
			label: "Nguồn nước",
			detail: waterDetail,
			color: WATER_COLOR,
			background: "bg-sky-50",
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
					return (
						<div
							key={card.label + card.detail}
							title="Số lượng trong dữ liệu hiện có quanh tuyến"
							className={`min-w-0 rounded-xl p-3 ${card.background}`}
						>
							<div className="flex items-center gap-2">
								<SafetySymbol kind={index === 4 ? "water" : "hazard"} color={card.color} />
								<strong className="text-xl font-extrabold text-[#10221b]">{counts[index]}</strong>
							</div>
							{card.label && (
								<p className="mt-1 text-xs font-semibold text-[#34483b]">{card.label}</p>
							)}
							{card.detail && <p className="mt-1 text-[10px] text-[#667a6d]">{card.detail}</p>}
						</div>
					);
				})}
			</div>
		</section>
	);
}
