import type { MapLayerMouseEvent, Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import { useEffect } from "react";
import { SAFETY_SOURCE_ID } from "../constants";
import {
	createSafetySymbol,
	featureColor,
	isDisplayableFeature,
	isMutedFeature,
} from "../map-symbols";
import { safetyPopupContent } from "../safety-popup";
import type { SafetyCollection } from "../types";

export function useSafetyMapSymbols(
	map: MapLibreMap | null,
	ready: boolean,
	data?: SafetyCollection
) {
	useEffect(() => {
		if (!map || !ready) return;
		let disposed = false;
		const markers: Marker[] = [];
		let pointPopup: Popup | undefined;
		let hoverPopup: Popup | undefined;
		const features = data?.features.filter(isDisplayableFeature) ?? [];
		const byId = new Map(features.map((feature) => [String(feature.id), feature]));
		const layers = [`${SAFETY_SOURCE_ID}-fill`, `${SAFETY_SOURCE_ID}-line`];
		const hover = (event: MapLayerMouseEvent) => {
			const id = event.features?.[0]?.id;
			const feature = id === undefined ? undefined : byId.get(String(id));
			if (feature)
				hoverPopup?.setLngLat(event.lngLat).setDOMContent(safetyPopupContent(feature)).addTo(map);
		};
		const leave = () => {
			hoverPopup?.remove();
		};
		void import("maplibre-gl").then(({ Marker: MapMarker, Popup: MapPopup }) => {
			if (disposed) return;
			pointPopup = new MapPopup({ closeButton: true, closeOnClick: true, offset: 18 });
			hoverPopup = new MapPopup({ closeButton: false, closeOnClick: false, offset: 12 });
			for (const feature of features) {
				if (feature.geometry.type !== "Point") continue;
				const element = document.createElement("button");
				const kind = feature.properties.sourceType === "RESOURCE" ? "water" : "hazard";
				element.type = "button";
				element.dataset.safetySymbol = kind;
				element.dataset.safetyUi = "";
				element.className = "cursor-pointer rounded bg-transparent p-0 drop-shadow-md";
				element.style.opacity = isMutedFeature(feature) ? "0.45" : "1";
				element.ariaLabel = feature.properties.description.split(" — ")[0].slice(0, 160);
				element.title = element.ariaLabel;
				element.append(createSafetySymbol(kind, featureColor(feature)));
				element.addEventListener("mousedown", (event) => event.stopPropagation());
				element.onclick = (event) => {
					event.stopPropagation();
					hoverPopup?.remove();
					if (feature.geometry.type === "Point")
						pointPopup
							?.setLngLat(feature.geometry.coordinates)
							.setDOMContent(safetyPopupContent(feature))
							.addTo(map);
				};
				markers.push(
					new MapMarker({ element, anchor: "center" })
						.setLngLat(feature.geometry.coordinates)
						.addTo(map)
				);
			}
			for (const layer of layers) {
				map.on("mousemove", layer, hover);
				map.on("mouseleave", layer, leave);
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
			}
		};
	}, [map, ready, data]);
}
