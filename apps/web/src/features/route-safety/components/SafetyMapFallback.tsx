import { useState } from "react";
import type { Position } from "../../trekking-routes/types";
import {
	featureColor,
	featureMarkerPoint,
	isDisplayableFeature,
	isMutedFeature,
} from "../map-symbols";
import { safetyText } from "../messages";
import type { SafetyCollection } from "../types";
import { SafetyDetailsModal } from "./SafetyDetailsModal";
import { SafetySymbol } from "./SafetySymbol";

export function SafetyMapFallback({
	data,
	project,
	areaClicksEnabled = true,
}: {
	data?: SafetyCollection;
	project: (position: Position) => Position;
	areaClicksEnabled?: boolean;
}) {
	const [selectedId, setSelectedId] = useState<string>();
	const features = data?.features.filter(isDisplayableFeature) ?? [];
	const selected = features.find((feature) => feature.id === selectedId);
	return (
		<div className="pointer-events-none absolute inset-0">
			<svg
				aria-hidden={areaClicksEnabled ? undefined : true}
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
							role={areaClicksEnabled ? "button" : undefined}
							tabIndex={areaClicksEnabled ? 0 : undefined}
							aria-label={areaClicksEnabled ? feature.properties.description : undefined}
							className={areaClicksEnabled ? "pointer-events-auto cursor-pointer" : undefined}
							onClick={(event) => {
								if (!areaClicksEnabled) return;
								event.stopPropagation();
								setSelectedId(feature.id);
							}}
							onKeyDown={(event) => {
								if (!areaClicksEnabled || (event.key !== "Enter" && event.key !== " ")) return;
								event.preventDefault();
								setSelectedId(feature.id);
							}}
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
				const point = featureMarkerPoint(feature);
				if (!point) return null;
				const [x, y] = project(point.coordinates);
				return (
					<button
						data-safety-ui
						data-safety-symbol={feature.properties.sourceType === "RESOURCE" ? "water" : "hazard"}
						key={feature.id}
						type="button"
						aria-label={`${feature.properties.sourceType === "ADMIN_VERIFIED" ? `${safetyText.verifiedZone.title}: ` : ""}${feature.properties.description.split(" — ")[0]}`}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							setSelectedId(feature.id);
						}}
						className={`pointer-events-auto absolute flex size-11 touch-manipulation -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/95 p-1 shadow-sm ${feature.properties.sourceType === "HOST_DEFINED" || feature.properties.sourceType === "ADMIN_VERIFIED" ? "z-20" : "z-10"}`}
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
				<SafetyDetailsModal feature={selected} onClose={() => setSelectedId(undefined)} />
			)}
		</div>
	);
}
