import type {
	LngLatLike,
	MapLayerMouseEvent,
	Map as MapLibreMap,
	Marker,
	Popup,
} from "maplibre-gl";
import { useEffect } from "react";
import type { RouteDangerZone } from "../types";
import { dangerZonePopupContent } from "../utils/danger-zone-popup";
import { dangerZoneDescription, severityColors } from "../utils/route-preview";

/** Shared by route previews and operational/editing maps. */
export function useDangerZoneMapDetails(
	map: MapLibreMap | null,
	ready: boolean,
	dangerZones: RouteDangerZone[],
	fillLayer: string,
	allowAreaDetails = true
) {
	useEffect(() => {
		if (!map || !ready) return;
		let disposed = false;
		const markers: Marker[] = [];
		let popup: Popup | undefined;
		const byId = new Map(dangerZones.map((zone) => [zone.id, zone]));
		const showDetails = (zone: RouteDangerZone, position: LngLatLike) => {
			if (!popup) return;
			const content = dangerZonePopupContent(zone);
			popup.setMaxWidth("240px").setLngLat(position).setDOMContent(content).addTo(map);
			const element = popup.getElement();
			const closeButton = element.querySelector<HTMLButtonElement>(
				".maplibregl-popup-close-button"
			);
			if (closeButton) {
				closeButton.ariaLabel = "Đóng thông tin điểm nguy hiểm";
				closeButton.title = closeButton.ariaLabel;
			}
			const mapBounds = map.getContainer().getBoundingClientRect();
			const popupBounds = element.getBoundingClientRect();
			// A side anchor can clip a wide popup on a narrow map; leave room for its marker offset.
			if (popupBounds.left < mapBounds.left || popupBounds.right > mapBounds.right) {
				popup.setMaxWidth(`${Math.max(120, Math.min(240, mapBounds.width / 2 - 24))}px`);
			}
			const adjustedBounds = element.getBoundingClientRect();
			if (adjustedBounds.top < mapBounds.top || adjustedBounds.bottom > mapBounds.bottom) {
				content.style.maxHeight = `${Math.max(80, mapBounds.height / 2 - 64)}px`;
				content.style.overflowY = "auto";
				popup.setLngLat(position);
			}
		};
		const selectArea = (event: MapLayerMouseEvent) => {
			if (!allowAreaDetails) return;
			const zone = byId.get(String(event.features?.[0]?.properties?.id));
			if (zone) showDetails(zone, event.lngLat);
		};
		void import("maplibre-gl").then(({ Marker: MapMarker, Popup: MapPopup }) => {
			if (disposed) return;
			popup = new MapPopup({ closeButton: true, closeOnClick: true, offset: 18 });
			for (const zone of dangerZones) {
				if (zone.geometry.type !== "Point") continue;
				const element = document.createElement("button");
				element.type = "button";
				element.className =
					"z-[1] flex size-8 cursor-pointer items-center justify-center rounded-full border-[3px] border-white text-base font-black text-white shadow-[0_0_0_2px_#172554] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";
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
					if (zone.geometry.type === "Point") showDetails(zone, zone.geometry.coordinates);
				};
				markers.push(new MapMarker({ element }).setLngLat(zone.geometry.coordinates).addTo(map));
			}
			map.on("click", fillLayer, selectArea);
		});
		return () => {
			disposed = true;
			for (const marker of markers) marker.remove();
			popup?.remove();
			map.off("click", fillLayer, selectArea);
		};
	}, [map, ready, dangerZones, fillLayer, allowAreaDetails]);
}
