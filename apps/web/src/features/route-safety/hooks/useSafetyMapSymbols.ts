import type { MapLayerMouseEvent, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useState } from "react";
import { SAFETY_SOURCE_ID } from "../constants";
import {
	createSafetySymbol,
	featureColor,
	featureMarkerPoint,
	isBareSymbol,
	isDisplayableFeature,
	isMutedFeature,
	markerFrameClass,
} from "../map-symbols";
import { safetyText } from "../messages";
import type { SafetyCollection } from "../types";

export function useSafetyMapSymbols(
	map: MapLibreMap | null,
	ready: boolean,
	data?: SafetyCollection,
	areaClicksEnabled = true,
	sourceId = SAFETY_SOURCE_ID
) {
	const [selectedId, setSelectedId] = useState<string>();
	useEffect(() => {
		if (!map || !ready) return;
		let disposed = false;
		const markers: Marker[] = [];
		const features = data?.features.filter(isDisplayableFeature) ?? [];
		const byId = new Map(features.map((feature) => [String(feature.id), feature]));
		const layers = [`${sourceId}-fill`, `${sourceId}-line`];
		const selectArea = (event: MapLayerMouseEvent) => {
			if (!areaClicksEnabled) return;
			const id = event.features?.[0]?.id;
			const feature = id === undefined ? undefined : byId.get(String(id));
			if (!feature) return;
			setSelectedId(feature.id);
		};
		void import("../../../core/maps/maplibre").then(({ Marker: MapMarker }) => {
			if (disposed) return;
			for (const feature of features) {
				const point = featureMarkerPoint(feature);
				if (!point) continue;
				const element = document.createElement("button");
				const kind = feature.properties.sourceType === "RESOURCE" ? "water" : "hazard";
				element.type = "button";
				element.dataset.safetySymbol = kind;
				element.dataset.safetyUi = "";
				element.className = `flex size-11 touch-manipulation cursor-pointer items-center justify-center ${markerFrameClass(feature)} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${feature.properties.sourceType === "ADMIN_VERIFIED" ? "z-20" : "z-[11]"}`;
				element.style.opacity = isMutedFeature(feature) ? "0.45" : "1";
				element.ariaLabel = feature.properties.description.split(" — ")[0].slice(0, 160);
				if (feature.properties.sourceType === "ADMIN_VERIFIED")
					element.ariaLabel = `${safetyText.verifiedZone.title}: ${element.ariaLabel}`;
				element.title = element.ariaLabel;
				element.append(createSafetySymbol(kind, featureColor(feature), !isBareSymbol(feature)));
				element.addEventListener("mousedown", (event) => event.stopPropagation());
				element.addEventListener("pointerdown", (event) => event.stopPropagation());
				element.onclick = (event) => {
					event.stopPropagation();
					setSelectedId(feature.id);
				};
				markers.push(
					new MapMarker({ element, anchor: "center" }).setLngLat(point.coordinates).addTo(map)
				);
			}
			for (const layer of layers) {
				if (areaClicksEnabled) map.on("click", layer, selectArea);
			}
		});
		return () => {
			disposed = true;
			for (const marker of markers) marker.remove();
			for (const layer of layers) {
				if (areaClicksEnabled) map.off("click", layer, selectArea);
			}
		};
	}, [map, ready, data, areaClicksEnabled, sourceId]);
	return {
		feature: ready ? data?.features.find((feature) => feature.id === selectedId) : undefined,
		onClose: () => setSelectedId(undefined),
	};
}
