import { useState } from "react";
import type { Position } from "../../trekking-routes/types";
import { featureColor, isDisplayableFeature, isMutedFeature } from "../map-symbols";
import { safetyPopupContent } from "../safety-popup";
import type { SafetyCollection } from "../types";
import { SafetySymbol } from "./SafetySymbol";

export function SafetyMapFallback({
	data,
	project,
}: { data?: SafetyCollection; project: (position: Position) => Position }) {
	const [selectedId, setSelectedId] = useState<string>();
	const features = data?.features.filter(isDisplayableFeature) ?? [];
	const selected = features.find((feature) => feature.id === selectedId);
	return (
		<div className="pointer-events-none absolute inset-0">
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				className="absolute inset-0 h-full w-full"
			>
				{features.flatMap((feature) => {
					if (feature.geometry.type === "Point") return [];
					const polygons =
						feature.geometry.type === "MultiPolygon"
							? feature.geometry.coordinates
							: feature.geometry.type === "Polygon"
								? [feature.geometry.coordinates]
								: [];
					if (feature.geometry.type === "LineString")
						return [
							<polyline
								key={feature.id}
								points={feature.geometry.coordinates
									.map((point) => project(point).join(","))
									.join(" ")}
								fill="none"
								stroke={featureColor(feature)}
								strokeWidth="0.6"
								opacity={isMutedFeature(feature) ? 0.4 : 1}
							/>,
						];
					return polygons.map((polygon, index) => (
						<path
							key={`${feature.id}:${index}`}
							d={polygon
								.map((ring) => `M${ring.map((point) => project(point).join(",")).join(" L")}Z`)
								.join(" ")}
							fill={featureColor(feature)}
							fillOpacity={isMutedFeature(feature) ? 0.06 : 0.2}
							fillRule="evenodd"
							stroke={featureColor(feature)}
							strokeWidth="0.6"
							opacity={isMutedFeature(feature) ? 0.4 : 1}
						/>
					));
				})}
			</svg>
			{features.map((feature) => {
				if (feature.geometry.type !== "Point") return null;
				const [x, y] = project(feature.geometry.coordinates);
				return (
					<button
						data-safety-ui
						data-safety-symbol={feature.properties.sourceType === "RESOURCE" ? "water" : "hazard"}
						key={feature.id}
						type="button"
						aria-label={feature.properties.description.split(" — ")[0]}
						onClick={() => setSelectedId(feature.id)}
						className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 drop-shadow-md"
						style={{ left: `${x}%`, top: `${y}%`, opacity: isMutedFeature(feature) ? 0.45 : 1 }}
					>
						<SafetySymbol
							kind={feature.properties.sourceType === "RESOURCE" ? "water" : "hazard"}
							color={featureColor(feature)}
						/>
					</button>
				);
			})}
			{selected && (
				<aside
					data-safety-ui
					aria-label="Thông tin bản đồ"
					className="pointer-events-auto absolute top-12 left-3 z-30 max-w-60 rounded-lg bg-white p-3 pr-7 shadow-lg"
				>
					<button
						type="button"
						aria-label="Đóng thông tin"
						onClick={() => setSelectedId(undefined)}
						className="absolute top-1 right-2 text-lg"
					>
						×
					</button>
					<div
						ref={(element) => {
							element?.replaceChildren(safetyPopupContent(selected));
						}}
					/>
				</aside>
			)}
		</div>
	);
}
