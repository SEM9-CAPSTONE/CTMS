import type { MapLayerMouseEvent, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useState } from "react";
import type { RouteDangerZone } from "../types";
import { dangerZoneDescription, severityColors } from "../utils/route-preview";

/** Shared by route previews and operational/editing maps. */
export function useDangerZoneMapDetails(
	map: MapLibreMap | null,
	ready: boolean,
	dangerZones: RouteDangerZone[],
	fillLayer: string,
	allowAreaDetails = true
) {
	const [selectedId, setSelectedId] = useState<string>();
	useEffect(() => {
		if (!map || !ready) return;
		let disposed = false;
		const markers: Marker[] = [];
		const byId = new Map(dangerZones.map((zone) => [zone.id, zone]));
		const selectArea = (event: MapLayerMouseEvent) => {
			if (!allowAreaDetails) return;
			const zone = byId.get(String(event.features?.[0]?.properties?.id));
			if (zone) setSelectedId(zone.id);
		};
		void import("maplibre-gl").then(({ Marker: MapMarker }) => {
			if (disposed) return;
			for (const zone of dangerZones) {
				if (zone.geometry.type !== "Point") continue;
				const element = document.createElement("button");
				element.type = "button";
				element.className =
					"z-20 flex size-11 touch-manipulation cursor-pointer items-center justify-center rounded-full border-[3px] border-white text-base font-black text-white shadow-[0_0_0_2px_#172554] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";
				element.style.backgroundColor = severityColors[zone.severity];
				element.textContent = "!";
				element.dataset.hazardPointMarker = "persisted";
				element.dataset.severity = zone.severity;
				element.ariaLabel = dangerZoneDescription(zone);
				element.title = element.ariaLabel;
				element.addEventListener("mousedown", (event) => event.stopPropagation());
				element.addEventListener("pointerdown", (event) => event.stopPropagation());
				element.onclick = (event) => {
					event.stopPropagation();
					setSelectedId(zone.id);
				};
				markers.push(new MapMarker({ element }).setLngLat(zone.geometry.coordinates).addTo(map));
			}
			map.on("click", fillLayer, selectArea);
		});
		return () => {
			disposed = true;
			for (const marker of markers) marker.remove();
			map.off("click", fillLayer, selectArea);
		};
	}, [map, ready, dangerZones, fillLayer, allowAreaDetails]);
	return {
		zone: ready ? dangerZones.find((zone) => zone.id === selectedId) : undefined,
		onClose: () => setSelectedId(undefined),
	};
}
