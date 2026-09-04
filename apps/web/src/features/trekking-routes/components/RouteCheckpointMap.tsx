import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	GeoJsonLineString,
	GeoJsonPoint,
	Position,
	RouteCheckpoint,
	RouteDangerZone,
	RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
	RouteMapMode,
} from "../types";
import {
	coordinateToPercent,
	geodesicCircle,
	percentToCoordinate,
	routeBounds,
} from "../utils/checkpoint-map";
import {
	dangerZoneFeatureCollection,
	dangerZonePolygon,
	dangerZonePositions,
	pointHazardPolygon,
} from "../utils/danger-zone-map";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

interface Props {
	geometry: GeoJsonLineString;
	checkpoints: RouteCheckpoint[];
	dangerZones?: RouteDangerZone[];
	mode?: RouteMapMode;
	selectedLocation?: GeoJsonPoint;
	radiusMeters: number;
	proposedHazard?: RouteDangerZoneGeometry;
	proposedHazardRadiusMeters?: number;
	polygonVertices?: Position[];
	disabled?: boolean;
	onSelectLocation: (location: GeoJsonPoint) => void;
}

const severityColors = { low: "#ca8a04", medium: "#ea580c", high: "#dc2626" } as const;
const severityLabels: Record<RouteDangerZoneSeverity, string> = {
	low: "thấp",
	medium: "trung bình",
	high: "cao",
};

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
	dangerZones = [],
	mode = "checkpoint",
	selectedLocation,
	radiusMeters,
	proposedHazard,
	proposedHazardRadiusMeters = 0,
	polygonVertices = [],
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
	const safetyPositions = useMemo(
		() => [
			...geometry.coordinates,
			...checkpoints.map((checkpoint) => checkpoint.location.coordinates),
			...dangerZonePositions(dangerZones),
			...polygonVertices,
		],
		[checkpoints, dangerZones, geometry.coordinates, polygonVertices]
	);
	const bounds = useMemo(() => routeBounds(safetyPositions), [safetyPositions]);
	const routePoints = useMemo(
		() =>
			geometry.coordinates.map((point) => coordinateToPercent(point, bounds).join(",")).join(" "),
		[bounds, geometry.coordinates]
	);
	const selectedCircle = useMemo(
		() =>
			mode === "checkpoint" && selectedLocation
				? geodesicCircle(selectedLocation, radiusMeters)
				: null,
		[mode, radiusMeters, selectedLocation]
	);
	const persistedHazards = useMemo(() => {
		const collection = dangerZoneFeatureCollection(dangerZones);
		return {
			...collection,
			features: collection.features.map((feature, index) => ({
				...feature,
				properties: {
					...feature.properties,
					sourceGeometry: dangerZones[index]?.geometry.type ?? "Polygon",
				},
			})),
		};
	}, [dangerZones]);
	const proposedHazardPolygon = useMemo(
		() =>
			proposedHazard
				? proposedHazard.type === "Point"
					? pointHazardPolygon(proposedHazard, proposedHazardRadiusMeters)
					: proposedHazard
				: undefined,
		[proposedHazard, proposedHazardRadiusMeters]
	);
	const proposedHazardFeature = useMemo(() => {
		if (!proposedHazardPolygon) return { type: "FeatureCollection" as const, features: [] };
		return {
			type: "FeatureCollection" as const,
			features: [{ type: "Feature" as const, properties: {}, geometry: proposedHazardPolygon }],
		};
	}, [proposedHazardPolygon]);
	const draftPolygonFeature = useMemo(
		() => ({
			type: "FeatureCollection" as const,
			features:
				polygonVertices.length > 1
					? [
							{
								type: "Feature" as const,
								properties: {},
								geometry: { type: "LineString" as const, coordinates: polygonVertices },
							},
						]
					: [],
		}),
		[polygonVertices]
	);
	const mapLabel =
		mode === "checkpoint"
			? "Bản đồ chọn checkpoint"
			: mode === "hazard-point"
				? "Bản đồ chọn điểm nguy hiểm"
				: "Bản đồ vẽ đa giác nguy hiểm";

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
					map.addSource("route-hazards", {
						type: "geojson",
						data: { type: "FeatureCollection", features: [] },
					});
					map.addLayer({
						id: "route-hazards-fill",
						type: "fill",
						source: "route-hazards",
						paint: {
							"fill-color": [
								"match",
								["get", "severity"],
								"low",
								"#ca8a04",
								"medium",
								"#ea580c",
								"high",
								"#dc2626",
								"#ea580c",
							],
							"fill-opacity": ["case", ["==", ["get", "sourceGeometry"], "Point"], 0.44, 0.28],
						},
					});
					map.addLayer({
						id: "route-hazards-outline",
						type: "line",
						source: "route-hazards",
						paint: {
							"line-color": [
								"case",
								["==", ["get", "sourceGeometry"], "Point"],
								"#172554",
								"#991b1b",
							],
							"line-width": ["case", ["==", ["get", "sourceGeometry"], "Point"], 3.5, 2],
						},
					});
					map.addSource("proposed-hazard", {
						type: "geojson",
						data: { type: "FeatureCollection", features: [] },
					});
					map.addLayer({
						id: "proposed-hazard-fill",
						type: "fill",
						source: "proposed-hazard",
						paint: { "fill-color": "#7c3aed", "fill-opacity": 0.25 },
					});
					map.addLayer({
						id: "proposed-hazard-outline",
						type: "line",
						source: "proposed-hazard",
						paint: { "line-color": "#6d28d9", "line-width": 2, "line-dasharray": [2, 2] },
					});
					map.addSource("draft-hazard-polygon", {
						type: "geojson",
						data: { type: "FeatureCollection", features: [] },
					});
					map.addLayer({
						id: "draft-hazard-polygon-line",
						type: "line",
						source: "draft-hazard-polygon",
						paint: { "line-color": "#6d28d9", "line-width": 2, "line-dasharray": [2, 2] },
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
		const hazardsSource = map.getSource("route-hazards") as
			| { setData?: (data: object) => void }
			| undefined;
		hazardsSource?.setData?.(persistedHazards);
		const proposedSource = map.getSource("proposed-hazard") as
			| { setData?: (data: object) => void }
			| undefined;
		proposedSource?.setData?.(proposedHazardFeature);
		const draftPolygonSource = map.getSource("draft-hazard-polygon") as
			| { setData?: (data: object) => void }
			| undefined;
		draftPolygonSource?.setData?.(draftPolygonFeature);
		fitRoute(map, safetyPositions);
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];
		void import("maplibre-gl").then(({ Marker: MapMarker }) => {
			if (mapRef.current !== map) return;
			const locations: Array<{
				point: Position;
				proposed: boolean;
				label: string;
				shelter: boolean;
				vertex: boolean;
				hazardSeverity?: RouteDangerZoneSeverity;
				hazardDescription?: string;
			}> = checkpoints.map((item, index) => ({
				point: item.location.coordinates,
				proposed: false,
				label: String(index + 1),
				shelter: item.type === "emergency_shelter",
				vertex: false,
			}));
			if (mode === "checkpoint" && selectedLocation) {
				locations.push({
					point: selectedLocation.coordinates,
					proposed: true,
					label: "",
					shelter: false,
					vertex: false,
				});
			}
			for (const zone of dangerZones) {
				if (zone.geometry.type !== "Point") continue;
				locations.push({
					point: zone.geometry.coordinates,
					proposed: false,
					label: "!",
					shelter: false,
					vertex: false,
					hazardSeverity: zone.severity,
					hazardDescription: zone.description,
				});
			}
			for (const [index, point] of polygonVertices.entries()) {
				locations.push({
					point,
					proposed: false,
					label: String(index + 1),
					shelter: false,
					vertex: true,
				});
			}
			markersRef.current = locations.map(
				({ point, proposed, label, shelter, vertex, hazardSeverity, hazardDescription }) => {
					const element = document.createElement("div");
					if (hazardSeverity) {
						element.className =
							"flex size-8 items-center justify-center rounded-full border-[3px] border-white text-base font-black text-white shadow-[0_0_0_2px_#172554]";
						element.style.backgroundColor = severityColors[hazardSeverity];
						element.dataset.hazardPointMarker = "persisted";
						element.dataset.severity = hazardSeverity;
					} else if (vertex) {
						element.className =
							"flex size-5 items-center justify-center rounded-full border-2 border-white bg-violet-700 text-[10px] font-extrabold text-white shadow";
					} else if (proposed) {
						element.className = "size-4 rounded-full border-2 border-white bg-teal-700 shadow";
					} else if (shelter) {
						element.className =
							"flex size-7 items-center justify-center rounded-md border-2 border-white bg-sky-700 text-xs font-extrabold text-white shadow";
					} else {
						element.className =
							"flex size-6 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-xs font-extrabold text-white shadow";
					}
					element.textContent = hazardSeverity ? "!" : shelter ? "S" : label;
					if (shelter) element.setAttribute("aria-label", `Nơi trú ẩn ${label}`);
					if (vertex) element.setAttribute("aria-label", `Đỉnh đa giác ${label}`);
					if (hazardSeverity) {
						const accessibleLabel = `Điểm nguy hiểm mức ${severityLabels[hazardSeverity]}: ${hazardDescription}`;
						element.setAttribute("aria-label", accessibleLabel);
						element.setAttribute("title", accessibleLabel);
					}
					return new MapMarker({ element }).setLngLat(point).addTo(map);
				}
			);
		});
	}, [
		checkpoints,
		dangerZones,
		draftPolygonFeature,
		mapReady,
		mode,
		persistedHazards,
		polygonVertices,
		proposedHazardFeature,
		safetyPositions,
		selectedCircle,
		selectedLocation,
	]);

	return (
		<div
			ref={containerRef}
			data-testid="checkpoint-map"
			data-map-mode={useFallback ? "fallback" : mapReady ? "maplibre" : "loading"}
			className="relative h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
		>
			{useFallback && (
				<svg
					aria-label={mapLabel}
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
					{dangerZones.map((zone) => {
						const isPoint = zone.geometry.type === "Point";
						return (
							<polygon
								key={zone.id}
								data-testid={`persisted-hazard-${zone.geometry.type.toLowerCase()}`}
								data-severity={zone.severity}
								points={dangerZonePolygon(zone)
									.coordinates[0].map((point) => coordinateToPercent(point, bounds).join(","))
									.join(" ")}
								fill={severityColors[zone.severity]}
								fillOpacity={isPoint ? "0.44" : "0.28"}
								stroke={isPoint ? "#172554" : "#991b1b"}
								strokeWidth={isPoint ? "0.9" : "0.45"}
							/>
						);
					})}
					{proposedHazardPolygon && (
						<polygon
							data-testid="proposed-hazard-preview"
							points={proposedHazardPolygon.coordinates[0]
								.map((point) => coordinateToPercent(point, bounds).join(","))
								.join(" ")}
							fill="#7c3aed"
							fillOpacity="0.25"
							stroke="#6d28d9"
							strokeWidth="0.45"
							strokeDasharray="1 1"
						/>
					)}
					{polygonVertices.length > 1 && (
						<polyline
							data-testid="draft-hazard-polygon"
							points={polygonVertices
								.map((point) => coordinateToPercent(point, bounds).join(","))
								.join(" ")}
							fill="none"
							stroke="#6d28d9"
							strokeWidth="0.55"
							strokeDasharray="1 1"
						/>
					)}
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
						if (checkpoint.type === "emergency_shelter") {
							return (
								<g key={checkpoint.id} data-testid={`shelter-marker-${index + 1}`}>
									<rect
										x={x - 2.7}
										y={y - 2.7}
										width="5.4"
										height="5.4"
										rx="0.8"
										fill="#0369a1"
										stroke="white"
										strokeWidth="0.5"
									/>
									<text
										x={x}
										y={y + 0.9}
										textAnchor="middle"
										fontSize="2.5"
										fontWeight="800"
										fill="white"
									>
										S
									</text>
								</g>
							);
						}
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
					{dangerZones.map((zone) => {
						if (zone.geometry.type !== "Point") return null;
						const [x, y] = coordinateToPercent(zone.geometry.coordinates, bounds);
						const accessibleLabel = `Điểm nguy hiểm mức ${severityLabels[zone.severity]}: ${zone.description}`;
						return (
							<g
								key={`point-marker-${zone.id}`}
								data-testid={`persisted-hazard-point-marker-${zone.id}`}
								data-severity={zone.severity}
								aria-label={accessibleLabel}
							>
								<title>{accessibleLabel}</title>
								<circle
									cx={x}
									cy={y}
									r="3.2"
									fill={severityColors[zone.severity]}
									stroke="#172554"
									strokeWidth="0.9"
								/>
								<text
									x={x}
									y={y + 1.25}
									textAnchor="middle"
									fontSize="4"
									fontWeight="900"
									fill="white"
								>
									!
								</text>
							</g>
						);
					})}
					{mode === "checkpoint" &&
						selectedLocation &&
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
					{polygonVertices.map((point, index) => {
						const [x, y] = coordinateToPercent(point, bounds);
						return (
							<circle
								key={`${point[0]}-${point[1]}-${index}`}
								data-testid={`polygon-vertex-${index + 1}`}
								cx={x}
								cy={y}
								r="1.3"
								fill="#6d28d9"
								stroke="white"
								strokeWidth="0.35"
							/>
						);
					})}
				</svg>
			)}
			{!styleUrl && (
				<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold">
					{mode === "checkpoint"
						? "Nhấp trên bản đồ để chọn vị trí checkpoint."
						: mode === "hazard-point"
							? "Nhấp trên bản đồ để chọn tâm vùng nguy hiểm."
							: "Nhấp liên tiếp để thêm các đỉnh đa giác."}
				</span>
			)}
			{mapError && (
				<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
					{mapError}
				</span>
			)}
			<div
				className="absolute right-3 bottom-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold"
				aria-label="Chú giải an toàn"
			>
				<span className="text-sky-800">S: Nơi trú ẩn</span>
				<span className="text-yellow-700">Nguy hiểm thấp</span>
				<span className="text-orange-700">Trung bình</span>
				<span className="text-red-700">Cao</span>
			</div>
		</div>
	);
}
