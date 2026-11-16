import type { MapLayerMouseEvent, Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import { useEffect } from "react";
import { SAFETY_SOURCE_ID } from "../constants";
import {
	createSafetySymbol,
	featureColor,
	featureMarkerPoint,
	isDisplayableFeature,
	isMutedFeature,
} from "../map-symbols";
import { safetyText } from "../messages";
import { safetyPopupContent } from "../safety-popup";
import type { SafetyCollection } from "../types";

export function useSafetyMapSymbols(
	map: MapLibreMap | null,
	ready: boolean,
	data?: SafetyCollection,
	areaClicksEnabled = true,
	sourceId = SAFETY_SOURCE_ID
) {
	useEffect(() => {
		if (!map || !ready) return;
		let disposed = false;
		const markers: Marker[] = [];
		let pointPopup: Popup | undefined;
		let hoverPopup: Popup | undefined;
		const features = data?.features.filter(isDisplayableFeature) ?? [];
		const popupContent = (feature: (typeof features)[number]) => {
			const content = safetyPopupContent(feature);
			const height = map.getContainer?.().clientHeight;
			if (height) {
				// Auto anchoring needs room on either side of the marker, including on short maps.
				content.style.maxHeight = `${Math.max(64, Math.floor(height / 2) - 72)}px`;
				content.style.overflowY = "auto";
				content.tabIndex = 0;
			}
			return content;
		};
		const byId = new Map(features.map((feature) => [String(feature.id), feature]));
		const layers = [`${sourceId}-fill`, `${sourceId}-line`];
		const selectArea = (event: MapLayerMouseEvent) => {
			if (!areaClicksEnabled) return;
			const id = event.features?.[0]?.id;
			const feature = id === undefined ? undefined : byId.get(String(id));
			if (!feature) return;
			hoverPopup?.remove();
			pointPopup?.setLngLat(event.lngLat).setDOMContent(popupContent(feature)).addTo(map);
			localizeCloseButton();
		};
		const localizeCloseButton = () => {
			const button = pointPopup
				?.getElement()
				?.querySelector<HTMLButtonElement>(".maplibregl-popup-close-button");
			if (button) {
				button.ariaLabel = safetyText.close;
				button.title = button.ariaLabel;
			}
		};
		const hover = (event: MapLayerMouseEvent) => {
			const id = event.features?.[0]?.id;
			const feature = id === undefined ? undefined : byId.get(String(id));
			if (feature)
				hoverPopup?.setLngLat(event.lngLat).setDOMContent(popupContent(feature)).addTo(map);
		};
		const leave = () => {
			hoverPopup?.remove();
		};
		void import("maplibre-gl").then(({ Marker: MapMarker, Popup: MapPopup }) => {
			if (disposed) return;
			pointPopup = new MapPopup({
				closeButton: true,
				closeOnClick: true,
				offset: 18,
				className: "z-30",
			});
			hoverPopup = new MapPopup({
				closeButton: false,
				closeOnClick: false,
				offset: 12,
				className: "z-30",
			});
			for (const feature of features) {
				const point = featureMarkerPoint(feature);
				if (!point) continue;
				const element = document.createElement("button");
				const kind = feature.properties.sourceType === "RESOURCE" ? "water" : "hazard";
				element.type = "button";
				element.dataset.safetySymbol = kind;
				element.dataset.safetyUi = "";
				element.className = `flex size-11 touch-manipulation cursor-pointer items-center justify-center rounded-full border-2 border-white bg-white/95 p-1 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${feature.properties.sourceType === "ADMIN_VERIFIED" ? "z-20" : "z-[11]"}`;
				element.style.opacity = isMutedFeature(feature) ? "0.45" : "1";
				element.ariaLabel = feature.properties.description.split(" — ")[0].slice(0, 160);
				if (feature.properties.sourceType === "ADMIN_VERIFIED")
					element.ariaLabel = `${safetyText.verifiedZone.title}: ${element.ariaLabel}`;
				element.title = element.ariaLabel;
				element.append(createSafetySymbol(kind, featureColor(feature)));
				element.addEventListener("mousedown", (event) => event.stopPropagation());
				element.addEventListener("pointerdown", (event) => event.stopPropagation());
				element.onclick = (event) => {
					event.stopPropagation();
					hoverPopup?.remove();
					pointPopup?.setLngLat(point.coordinates).setDOMContent(popupContent(feature)).addTo(map);
					localizeCloseButton();
				};
				markers.push(
					new MapMarker({ element, anchor: "center" }).setLngLat(point.coordinates).addTo(map)
				);
			}
			for (const layer of layers) {
				map.on("mousemove", layer, hover);
				map.on("mouseleave", layer, leave);
				if (areaClicksEnabled) map.on("click", layer, selectArea);
			}
		});
		return () => {
			disposed = true;
			for (const marker of markers) marker.remove();
			pointPopup?.remove();
			hoverPopup?.remove();
			for (const layer of layers) {
				map.off("mousemove", layer, hover);
				map.off("mouseleave", layer, leave);
				if (areaClicksEnabled) map.off("click", layer, selectArea);
			}
		};
	}, [map, ready, data, areaClicksEnabled, sourceId]);
}
