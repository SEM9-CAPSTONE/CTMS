import type { GeoJsonLineString, RouteCheckpoint, RouteDangerZone } from "../types";
import { dangerZonePolygon } from "../utils/danger-zone-map";
import {
	type PreviewBounds,
	dangerZoneDescription,
	fallbackCoordinate,
	fallbackPoints,
	severityColors,
} from "../utils/route-preview";
import { RoutePreviewCheckpoint } from "./RoutePreviewCheckpoint";
interface Props {
	geometry: GeoJsonLineString;
	checkpoints: RouteCheckpoint[];
	dangerZones: RouteDangerZone[];
	bounds: PreviewBounds;
}
export function RoutePreviewFallback({ geometry, checkpoints, dangerZones, bounds }: Props) {
	const points = fallbackPoints(geometry.coordinates, bounds);
	return (
		<svg
			aria-label="Bản đồ tuyến đường"
			viewBox="0 0 100 100"
			className="absolute inset-0 h-full w-full"
			role="img"
		>
			{dangerZones.map((dangerZone) => {
				const description = dangerZoneDescription(dangerZone);
				const point = dangerZone.geometry.type === "Point";
				return (
					<polygon
						key={`hazard-area-${dangerZone.id}`}
						data-testid={`route-preview-hazard-${dangerZone.id}`}
						data-geometry-type={dangerZone.geometry.type}
						data-severity={dangerZone.severity}
						points={dangerZonePolygon(dangerZone)
							.coordinates[0].map((coordinate) => fallbackCoordinate(coordinate, bounds).join(","))
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
						data-severity={dangerZone.severity}
						aria-label={description}
					>
						<title>{description}</title>
						<circle
							cx={x}
							cy={y}
							r="3.6"
							fill={severityColors[dangerZone.severity]}
							stroke="#172554"
							strokeWidth="0.9"
						/>
						<text
							x={x}
							y={y + 1.35}
							textAnchor="middle"
							fontSize="4.2"
							fontWeight="900"
							fill="white"
						>
							!
						</text>
					</g>
				);
			})}
		</svg>
	);
}
