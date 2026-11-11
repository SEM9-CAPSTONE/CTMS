import type { Position } from "../types";

export const DEFAULT_ROUTE_CENTER: Position = [108.2022, 16.0544];

export function getRouteMapStyleUrl(mapTilerKey: string | undefined): string {
	return mapTilerKey ? `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${mapTilerKey}` : "";
}
