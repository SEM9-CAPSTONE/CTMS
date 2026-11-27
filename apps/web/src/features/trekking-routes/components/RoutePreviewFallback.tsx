import { useState } from "react";
import type { GeoJsonLineString, Position, RouteCheckpoint, RouteDangerZone } from "../types";
import { dangerZonePolygon } from "../utils/danger-zone-map";
import { waypointMarker } from "../utils/route-map";
import {
	type PreviewBounds,
	dangerZoneDescription,
	fallbackCoordinate,
	fallbackPoints,
	severityColors,
} from "../utils/route-preview";
import { DangerZoneDetailsModal } from "./DangerZoneDetailsModal";
import { HazardWarningMark } from "./HazardWarningMark";
import { RoutePreviewCheckpoint } from "./RoutePreviewCheckpoint";
interface Props {
	geometry: GeoJsonLineString;
	waypoints?: Position[];
	checkpoints: RouteCheckpoint[];
	dangerZones: RouteDangerZone[];
	bounds: PreviewBounds;
}
export function RoutePreviewFallback({
	geometry,
	waypoints,
	checkpoints,
	dangerZones,
	bounds,
}: Props) {
	const [selectedId, setSelectedId] = useState<string>();
	const selected = dangerZones.find((zone) => zone.id === selectedId);
	const points = fallbackPoints(geometry.coordinates, bounds);
	return (
		<>
			<svg
				aria-label="Bản đồ tuyến đường"
				viewBox="0 0 100 100"
				className="absolute inset-0 h-full w-full"
				role="img"
			>
				{dangerZones.map((dangerZone) => {
					const description = dangerZoneDescription(dangerZone);
					const point = dangerZone.geometry.type === "Point";
					if (point) return null;
					return (
						<polygon
							key={`hazard-area-${dangerZone.id}`}
							data-testid={`route-preview-hazard-${dangerZone.id}`}
							onClick={() => setSelectedId(dangerZone.id)}
							data-geometry-type={dangerZone.geometry.type}
							data-severity={dangerZone.severity}
							points={dangerZonePolygon(dangerZone)
								.coordinates[0].map((coordinate) =>
									fallbackCoordinate(coordinate, bounds).join(",")
								)
								.join(" ")}
							fill={severityColors[dangerZone.severity]}
							fillOpacity={point ? "0.44" : "0.28"}
							stroke={point ? "#172554" : "#991b1b"}
							strokeWidth={point ? "0.9" : "0.45"}
							aria-label={description}
						>
							<title>{description}</title>
						</polygon>
					);
				})}
				<polyline
					data-testid="route-preview-line"
					points={points}
					fill="none"
					stroke="#ef6c35"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				{waypoints?.map((point, index) => {
					const [x, y] = fallbackCoordinate(point, bounds);
					const { label, symbol } = waypointMarker(index, waypoints.length);
					return (
						<g key={label} aria-label={label}>
							<title>{label}</title>
							<circle cx={x} cy={y} r="2.2" fill="#164027" stroke="white" strokeWidth="0.5" />
							<text
								x={x}
								y={y}
								textAnchor="middle"
								dominantBaseline="central"
								fontSize="2.2"
								fill="white"
							>
								{symbol}
							</text>
						</g>
					);
				})}
				{checkpoints.map((checkpoint, index) => (
					<RoutePreviewCheckpoint
						key={checkpoint.id}
						checkpoint={checkpoint}
						index={index}
						bounds={bounds}
					/>
				))}
				{dangerZones.map((dangerZone) => {
					if (dangerZone.geometry.type !== "Point") return null;
					const [x, y] = fallbackCoordinate(dangerZone.geometry.coordinates, bounds);
					const description = dangerZoneDescription(dangerZone);
					return (
						<g
							key={`hazard-marker-${dangerZone.id}`}
							data-testid={`route-preview-hazard-marker-${dangerZone.id}`}
							// biome-ignore lint/a11y/useSemanticElements: A focusable SVG group preserves marker coordinates.
							role="button"
							tabIndex={0}
							className="cursor-pointer hover:opacity-80 focus-visible:outline"
							onClick={() => setSelectedId(dangerZone.id)}
							onKeyDown={(event) => {
								if (event.key !== "Enter" && event.key !== " ") return;
								event.preventDefault();
								setSelectedId(dangerZone.id);
							}}
							data-severity={dangerZone.severity}
							aria-label={description}
						>
							<title>{description}</title>
							<HazardWarningMark x={x} y={y} />
						</g>
					);
				})}
			</svg>
			{selected && (
				<DangerZoneDetailsModal zone={selected} onClose={() => setSelectedId(undefined)} />
			)}
		</>
	);
}
