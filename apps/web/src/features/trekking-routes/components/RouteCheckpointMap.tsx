import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJsonLineString, GeoJsonPoint, Position, RouteCheckpoint } from "../types";
import {
	coordinateToPercent,
	geodesicCircle,
	percentToCoordinate,
	routeBounds,
} from "../utils/checkpoint-map";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

interface Props {
	geometry: GeoJsonLineString;
	checkpoints: RouteCheckpoint[];
	selectedLocation?: GeoJsonPoint;
	radiusMeters: number;
	disabled?: boolean;
	onSelectLocation: (location: GeoJsonPoint) => void;
}

function fitRoute(map: MapLibreMap, coordinates: Position[]): void {
	if (coordinates.length < 2) return;
	const bounds = routeBounds(coordinates, 0);
	map.fitBounds(
		[
			[bounds.minLongitude, bounds.minLatitude],
			[bounds.maxLongitude, bounds.maxLatitude],
		],
		{ padding: 48, maxZoom: 16, duration: 0 }
	);
}

export function RouteCheckpointMap({
	geometry,
	checkpoints,
	selectedLocation,
	radiusMeters,
	disabled,
	onSelectLocation,
}: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const markersRef = useRef<Marker[]>([]);
	const selectRef = useRef(onSelectLocation);
	const disabledRef = useRef(disabled);
	const [mapError, setMapError] = useState("");
	const [mapReady, setMapReady] = useState(false);
	const styleUrl = getRouteMapStyleUrl(import.meta.env.VITE_MAPTILER_API_KEY as string | undefined);
	const useFallback = !styleUrl || Boolean(mapError);
	const bounds = useMemo(() => routeBounds(geometry.coordinates), [geometry.coordinates]);
	const routePoints = useMemo(
		() =>
			geometry.coordinates.map((point) => coordinateToPercent(point, bounds).join(",")).join(" "),
		[bounds, geometry.coordinates]
	);
	const selectedCircle = useMemo(
		() => (selectedLocation ? geodesicCircle(selectedLocation, radiusMeters) : null),
		[radiusMeters, selectedLocation]
	);

	useEffect(() => {
		selectRef.current = onSelectLocation;
		disabledRef.current = disabled;
	}, [disabled, onSelectLocation]);

	useEffect(() => {
		if (!styleUrl || !containerRef.current) return;
		let disposed = false;
		void import("maplibre-gl")
			.then((maplibre) => {
				if (disposed || !containerRef.current) return;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: styleUrl,
					center: geometry.coordinates[0] ?? DEFAULT_ROUTE_CENTER,
					zoom: 13,
					attributionControl: false,
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
				map.on("click", (event) => {
					if (!disabledRef.current) {
						selectRef.current({ type: "Point", coordinates: [event.lngLat.lng, event.lngLat.lat] });
					}
				});
				map.on("load", () => {
					map.addSource("checkpoint-route", {
						type: "geojson",
						data: { type: "Feature", properties: {}, geometry },
					});
					map.addLayer({
						id: "checkpoint-route-line",
						type: "line",
						source: "checkpoint-route",
						paint: { "line-color": "#ef6c35", "line-width": 5 },
					});
					map.addSource("checkpoint-radius", {
						type: "geojson",
						data: { type: "FeatureCollection", features: [] },
					});
					map.addLayer({
						id: "checkpoint-radius-fill",
						type: "fill",
						source: "checkpoint-radius",
						paint: { "fill-color": "#0f766e", "fill-opacity": 0.22 },
					});
					fitRoute(map, geometry.coordinates);
					setMapReady(true);
				});
				map.on("error", () => setMapError("Không thể tải bản đồ; đang dùng chế độ fallback."));
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải MapLibre; đang dùng chế độ fallback."));
		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [geometry, styleUrl]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReady) return;
		const radiusSource = map.getSource("checkpoint-radius") as
			| { setData?: (data: object) => void }
			| undefined;
		radiusSource?.setData?.(selectedCircle ?? { type: "FeatureCollection", features: [] });
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];
		void import("maplibre-gl").then(({ Marker: MapMarker }) => {
			if (mapRef.current !== map) return;
			const locations = checkpoints.map((item, index) => ({
				point: item.location.coordinates,
				proposed: false,
				label: String(index + 1),
			}));
			if (selectedLocation)
				locations.push({ point: selectedLocation.coordinates, proposed: true, label: "" });
			markersRef.current = locations.map(({ point, proposed, label }) => {
				const element = document.createElement("div");
				element.className = proposed
					? "size-4 rounded-full border-2 border-white bg-teal-700 shadow"
					: "flex size-6 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-xs font-extrabold text-white shadow";
				element.textContent = label;
				return new MapMarker({ element }).setLngLat(point).addTo(map);
			});
		});
	}, [checkpoints, mapReady, selectedCircle, selectedLocation]);

	return (
		<div
			ref={containerRef}
			data-testid="checkpoint-map"
			data-map-mode={useFallback ? "fallback" : mapReady ? "maplibre" : "loading"}
			className="relative h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
		>
			{useFallback && (
				<svg
					aria-label="Bản đồ chọn checkpoint"
					viewBox="0 0 100 100"
					className={`absolute inset-0 h-full w-full ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
					role="img"
					onClick={(event) => {
						if (disabled) return;
						const rect = event.currentTarget.getBoundingClientRect();
						const percent: Position = [
							((event.clientX - rect.left) / rect.width) * 100,
							((event.clientY - rect.top) / rect.height) * 100,
						];
						onSelectLocation({ type: "Point", coordinates: percentToCoordinate(percent, bounds) });
					}}
				>
					<polyline points={routePoints} fill="none" stroke="#ef6c35" strokeWidth="1.4" />
					{selectedCircle && (
						<polygon
							data-testid="checkpoint-radius-circle"
							points={selectedCircle.geometry.coordinates[0]
								.map((point) => coordinateToPercent(point, bounds).join(","))
								.join(" ")}
							fill="#0f766e"
							fillOpacity="0.22"
							stroke="#0f766e"
							strokeWidth="0.35"
						/>
					)}
					{checkpoints.map((checkpoint, index) => {
						const [x, y] = coordinateToPercent(checkpoint.location.coordinates, bounds);
						return (
							<g key={checkpoint.id} data-testid={`checkpoint-marker-${index + 1}`}>
								<circle cx={x} cy={y} r="2.4" fill="#ea580c" stroke="white" strokeWidth="0.5" />
								<text
									x={x}
									y={y + 0.9}
									textAnchor="middle"
									fontSize="2.5"
									fontWeight="800"
									fill="white"
								>
									{index + 1}
								</text>
							</g>
						);
					})}
					{selectedLocation &&
						(() => {
							const [x, y] = coordinateToPercent(selectedLocation.coordinates, bounds);
							return (
								<circle
									data-testid="selected-checkpoint-marker"
									cx={x}
									cy={y}
									r="1.6"
									fill="#0f766e"
								/>
							);
						})()}
				</svg>
			)}
			{!styleUrl && (
				<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold">
					Nhấp trên bản đồ để chọn vị trí checkpoint.
				</span>
			)}
			{mapError && (
				<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
					{mapError}
				</span>
			)}
		</div>
	);
}
