import type { Map as MapLibreMap } from "maplibre-gl";

/** An idle map has rendered its current view, including all requested tiles. */
export function trackMapRenderReadiness(map: MapLibreMap, container: HTMLElement): void {
	container.dataset.mapRendered = "false";
	map.on("dataloading", () => {
		container.dataset.mapRendered = "false";
	});
	map.on("movestart", () => {
		container.dataset.mapRendered = "false";
	});
	map.on("idle", () => {
		container.dataset.mapRendered = String(
			map.isStyleLoaded() && map.areTilesLoaded() && !map.isMoving()
		);
	});
}
