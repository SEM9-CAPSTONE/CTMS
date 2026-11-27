import type { Position } from "../types";

export const DEFAULT_ROUTE_CENTER: Position = [108.2022, 16.0544];

export const DRAWING_POINT_CLASS =
	"grid size-8 place-items-center rounded-full after:size-3 after:rounded-full after:border-2 after:border-white after:bg-[#164027] after:shadow";

export function drawingPointLabel(index: number): string {
	return `Điểm vẽ ${index + 1}`;
}

export function waypointMarker(index: number, count: number) {
	if (index === 0) return { label: "Điểm bắt đầu", symbol: "B", color: "bg-[#164027]" };
	if (index === count - 1) return { label: "Điểm kết thúc", symbol: "K", color: "bg-[#9a3412]" };
	return { label: `Điểm trung gian ${index}`, symbol: String(index), color: "bg-[#1e40af]" };
}

export function getRouteMapStyleUrl(mapTilerKey: string | undefined): string {
	return mapTilerKey ? `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${mapTilerKey}` : "";
}
