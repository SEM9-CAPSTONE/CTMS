import type { Map as MapLibreMap } from "maplibre-gl";
import type { Position, RouteCheckpoint, RouteDangerZone, RouteDangerZoneSeverity } from "../types";
export interface PreviewBounds {
	minLongitude: number;
	maxLongitude: number;
	minLatitude: number;
	maxLatitude: number;
}

export const checkpointTypeLabels: Record<RouteCheckpoint["type"], string> = {
	start: "Bắt đầu",
	rest: "Nghỉ chân",
	water: "Nguồn nước",
	dangerous: "Nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Kết thúc",
};
export const EMPTY_CHECKPOINTS: RouteCheckpoint[] = [];
export const EMPTY_DANGER_ZONES: RouteDangerZone[] = [];
export const severityColors = { low: "#ca8a04", medium: "#ea580c", high: "#dc2626" } as const;
export const severityLabels: Record<RouteDangerZoneSeverity, string> = {
	low: "thấp",
	medium: "trung bình",
	high: "cao",
};

export function previewBounds(coordinates: Position[]): PreviewBounds {
	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	return {
		minLongitude: Math.min(...longitudes),
		maxLongitude: Math.max(...longitudes),
		minLatitude: Math.min(...latitudes),
		maxLatitude: Math.max(...latitudes),
	};
}

export function fallbackCoordinate(
	[longitude, latitude]: Position,
	{ minLongitude, maxLongitude, minLatitude, maxLatitude }: PreviewBounds
): Position {
	const longitudeRange = maxLongitude - minLongitude || 1;
	const latitudeRange = maxLatitude - minLatitude || 1;
	return [
		8 + ((longitude - minLongitude) / longitudeRange) * 84,
		92 - ((latitude - minLatitude) / latitudeRange) * 84,
	];
}

export function fallbackPoints(coordinates: Position[], bounds: PreviewBounds): string {
	return coordinates
		.map((coordinate) => fallbackCoordinate(coordinate, bounds).join(","))
		.join(" ");
}

export function fitRoute(map: MapLibreMap, coordinates: Position[]): void {
	if (coordinates.length === 0) return;
	if (coordinates.length === 1) {
		map.jumpTo({ center: coordinates[0], zoom: 14 });
		return;
	}

	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	map.fitBounds(
		[
			[Math.min(...longitudes), Math.min(...latitudes)],
			[Math.max(...longitudes), Math.max(...latitudes)],
		],
		{ padding: 48, maxZoom: 15, duration: 0 }
	);
}

export function checkpointMarkerLabel(checkpoint: RouteCheckpoint, index: number): string {
	const labels: Record<RouteCheckpoint["type"], string> = {
		start: "S",
		rest: String(index + 1),
		water: "W",
		dangerous: "!",
		emergency_shelter: "⌂",
		finish: "F",
	};
	return labels[checkpoint.type];
}

export function checkpointMarkerColor(type: RouteCheckpoint["type"]): string {
	if (type === "emergency_shelter") return "#0369a1";
	if (type === "dangerous") return "#dc2626";
	if (type === "water") return "#0f766e";
	return "#ea580c";
}

export function checkpointDescription(checkpoint: RouteCheckpoint): string {
	return `${checkpoint.name} · ${checkpointTypeLabels[checkpoint.type]} · ${checkpoint.radiusMeters} m`;
}

export function dangerZoneDescription(dangerZone: RouteDangerZone): string {
	return `Khu vực nguy hiểm mức ${severityLabels[dangerZone.severity]}: ${dangerZone.description}`;
}
