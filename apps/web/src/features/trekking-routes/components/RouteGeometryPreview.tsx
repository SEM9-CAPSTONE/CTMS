import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	GeoJsonLineString,
	Position,
	RouteCheckpoint,
	RouteDangerZone,
	RouteDangerZoneSeverity,
} from "../types";
import {
	dangerZoneFeatureCollection,
	dangerZonePolygon,
	dangerZonePositions,
} from "../utils/danger-zone-map";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

interface RouteGeometryPreviewProps {
	geometry: GeoJsonLineString;
	checkpoints?: RouteCheckpoint[];
	dangerZones?: RouteDangerZone[];
}

interface PreviewBounds {
	minLongitude: number;
	maxLongitude: number;
	minLatitude: number;
	maxLatitude: number;
}

const checkpointTypeLabels: Record<RouteCheckpoint["type"], string> = {
	start: "Bắt đầu",
	rest: "Nghỉ chân",
	water: "Nguồn nước",
	dangerous: "Nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Kết thúc",
};
const EMPTY_CHECKPOINTS: RouteCheckpoint[] = [];
const EMPTY_DANGER_ZONES: RouteDangerZone[] = [];
const severityColors = { low: "#ca8a04", medium: "#ea580c", high: "#dc2626" } as const;
const severityLabels: Record<RouteDangerZoneSeverity, string> = {
	low: "thấp",
	medium: "trung bình",
	high: "cao",
};

function previewBounds(coordinates: Position[]): PreviewBounds {
	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	return {
		minLongitude: Math.min(...longitudes),
		maxLongitude: Math.max(...longitudes),
		minLatitude: Math.min(...latitudes),
		maxLatitude: Math.max(...latitudes),
	};
}

function fallbackCoordinate(
	[longitude, latitude]: Position,
	{ minLongitude, maxLongitude, minLatitude, maxLatitude }: PreviewBounds
): Position {
	const longitudeRange = maxLongitude - minLongitude || 1;
	const latitudeRange = maxLatitude - minLatitude || 1;
	return [
		8 + ((longitude - minLongitude) / longitudeRange) * 84,
		92 - ((latitude - minLatitude) / latitudeRange) * 84,
	];
}

function fallbackPoints(coordinates: Position[], bounds: PreviewBounds): string {
	return coordinates
		.map((coordinate) => fallbackCoordinate(coordinate, bounds).join(","))
		.join(" ");
}

function fitRoute(map: MapLibreMap, coordinates: Position[]): void {
	if (coordinates.length === 0) return;
	if (coordinates.length === 1) {
		map.jumpTo({ center: coordinates[0], zoom: 14 });
		return;
	}

	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	map.fitBounds(
		[
			[Math.min(...longitudes), Math.min(...latitudes)],
			[Math.max(...longitudes), Math.max(...latitudes)],
		],
		{ padding: 48, maxZoom: 15, duration: 0 }
	);
}

function checkpointMarkerLabel(checkpoint: RouteCheckpoint, index: number): string {
	const labels: Record<RouteCheckpoint["type"], string> = {
		start: "S",
		rest: String(index + 1),
		water: "W",
		dangerous: "!",
		emergency_shelter: "⌂",
		finish: "F",
	};
	return labels[checkpoint.type];
}

function checkpointMarkerColor(type: RouteCheckpoint["type"]): string {
	if (type === "emergency_shelter") return "#0369a1";
	if (type === "dangerous") return "#dc2626";
	if (type === "water") return "#0f766e";
	return "#ea580c";
}

function checkpointDescription(checkpoint: RouteCheckpoint): string {
	return `${checkpoint.name} · ${checkpointTypeLabels[checkpoint.type]} · ${checkpoint.radiusMeters} m · ${checkpoint.expectedArrivalOffset} phút`;
}

function dangerZoneDescription(dangerZone: RouteDangerZone): string {
	return `Khu vực nguy hiểm mức ${severityLabels[dangerZone.severity]}: ${dangerZone.description}`;
}

export function RouteGeometryPreview({
	geometry,
	checkpoints: providedCheckpoints,
	dangerZones: providedDangerZones,
}: RouteGeometryPreviewProps) {
	const checkpoints = providedCheckpoints ?? EMPTY_CHECKPOINTS;
	const dangerZones = providedDangerZones ?? EMPTY_DANGER_ZONES;
	const checkpointTypes = useMemo(
		() => new Set(checkpoints.map((checkpoint) => checkpoint.type)),
		[checkpoints]
	);
	const dangerZoneSeverities = useMemo(
		() => new Set(dangerZones.map((dangerZone) => dangerZone.severity)),
		[dangerZones]
	);
	const pointHazard = dangerZones.find((dangerZone) => dangerZone.geometry.type === "Point");
	const polygonHazard = dangerZones.find((dangerZone) => dangerZone.geometry.type === "Polygon");
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const markersRef = useRef<Marker[]>([]);
	const geometryRef = useRef(geometry);
	const checkpointsRef = useRef(checkpoints);
	const dangerZonesRef = useRef(dangerZones);
	const [mapError, setMapError] = useState("");
	const [mapReady, setMapReady] = useState(false);
	const key = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
	const styleUrl = getRouteMapStyleUrl(key);
	const useFallback = !styleUrl || Boolean(mapError);
	const previewPositions = useMemo(
		() => [
			...geometry.coordinates,
			...checkpoints.map((checkpoint) => checkpoint.location.coordinates),
			...dangerZonePositions(dangerZones),
		],
		[checkpoints, dangerZones, geometry.coordinates]
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
	const bounds = useMemo(() => previewBounds(previewPositions), [previewPositions]);
	const points = useMemo(
		() => fallbackPoints(geometry.coordinates, bounds),
		[bounds, geometry.coordinates]
	);

	useEffect(() => {
		geometryRef.current = geometry;
		checkpointsRef.current = checkpoints;
		dangerZonesRef.current = dangerZones;
	}, [checkpoints, dangerZones, geometry]);

	useEffect(() => {
		if (!styleUrl || !containerRef.current) return;
		let disposed = false;

		void import("maplibre-gl")
			.then((maplibre) => {
				if (disposed || !containerRef.current) return;
				const initialGeometry = geometryRef.current;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: styleUrl,
					center: initialGeometry.coordinates[0] ?? DEFAULT_ROUTE_CENTER,
					zoom: 13,
					attributionControl: false,
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
				map.on("load", () => {
					map.addSource("route-preview-hazards", {
						type: "geojson",
						data: { type: "FeatureCollection", features: [] },
					});
					map.addLayer({
						id: "route-preview-hazards-fill",
						type: "fill",
						source: "route-preview-hazards",
						paint: {
							"fill-color": [
								"match",
								["get", "severity"],
								"low",
								severityColors.low,
								"medium",
								severityColors.medium,
								"high",
								severityColors.high,
								severityColors.medium,
							],
							"fill-opacity": ["case", ["==", ["get", "sourceGeometry"], "Point"], 0.44, 0.28],
						},
					});
					map.addLayer({
						id: "route-preview-hazards-outline",
						type: "line",
						source: "route-preview-hazards",
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
					map.addSource("route-preview", {
						type: "geojson",
						data: { type: "Feature", properties: {}, geometry: geometryRef.current },
					});
					map.addLayer({
						id: "route-preview-line",
						type: "line",
						source: "route-preview",
						paint: { "line-color": "#ef6c35", "line-width": 5 },
					});
					fitRoute(map, [
						...geometryRef.current.coordinates,
						...checkpointsRef.current.map((checkpoint) => checkpoint.location.coordinates),
						...dangerZonePositions(dangerZonesRef.current),
					]);
					setMapReady(true);
				});
				map.on("error", () => setMapError("Không thể tải MapTiler; đang dùng bản đồ fallback."));
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải MapLibre; đang dùng bản đồ fallback."));

		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [styleUrl]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReady) return;
		const source = map.getSource("route-preview") as
			| { setData?: (data: object) => void }
			| undefined;
		source?.setData?.({ type: "Feature", properties: {}, geometry });
		const hazardsSource = map.getSource("route-preview-hazards") as
			| { setData?: (data: object) => void }
			| undefined;
		hazardsSource?.setData?.(persistedHazards);
		fitRoute(map, previewPositions);
	}, [geometry, mapReady, persistedHazards, previewPositions]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReady) return;
		let disposed = false;
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];

		void import("maplibre-gl").then(({ Marker: MapMarker }) => {
			if (disposed || mapRef.current !== map) return;
			markersRef.current = checkpoints.map((checkpoint, index) => {
				const element = document.createElement("div");
				const shelter = checkpoint.type === "emergency_shelter";
				element.className = shelter
					? "flex size-7 items-center justify-center rounded-md border-2 border-white text-xs font-extrabold text-white shadow"
					: "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow";
				element.style.backgroundColor = checkpointMarkerColor(checkpoint.type);
				element.textContent = checkpointMarkerLabel(checkpoint, index);
				element.dataset.checkpointType = checkpoint.type;
				const description = checkpointDescription(checkpoint);
				element.setAttribute("aria-label", description);
				element.setAttribute("title", description);
				return new MapMarker({ element }).setLngLat(checkpoint.location.coordinates).addTo(map);
			});
			for (const dangerZone of dangerZones) {
				if (dangerZone.geometry.type !== "Point") continue;
				const element = document.createElement("div");
				element.className =
					"flex size-8 items-center justify-center rounded-full border-[3px] border-white text-base font-black text-white shadow-[0_0_0_2px_#172554]";
				element.style.backgroundColor = severityColors[dangerZone.severity];
				element.textContent = "!";
				element.dataset.hazardPointMarker = "persisted";
				element.dataset.severity = dangerZone.severity;
				const description = dangerZoneDescription(dangerZone);
				element.setAttribute("aria-label", description);
				element.setAttribute("title", description);
				markersRef.current.push(
					new MapMarker({ element }).setLngLat(dangerZone.geometry.coordinates).addTo(map)
				);
			}
		});

		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
		};
	}, [checkpoints, dangerZones, mapReady]);

	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			<h2 className="font-extrabold text-[#10221b]">Xem trước hình học tuyến đường</h2>
			<div
				ref={containerRef}
				data-testid="route-geometry-preview"
				className="relative mt-4 h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
			>
				{useFallback && (
					<svg
						aria-label="Hình học tuyến đường"
						viewBox="0 0 100 100"
						className="absolute inset-0 h-full w-full"
						role="img"
					>
						{dangerZones.map((dangerZone) => {
							const description = dangerZoneDescription(dangerZone);
							const point = dangerZone.geometry.type === "Point";
							return (
								<polygon
									key={`hazard-area-${dangerZone.id}`}
									data-testid={`route-preview-hazard-${dangerZone.id}`}
									data-geometry-type={dangerZone.geometry.type}
									data-severity={dangerZone.severity}
									points={dangerZonePolygon(dangerZone)
										.coordinates[0].map((coordinate) =>
											fallbackCoordinate(coordinate, bounds).join(",")
										)
										.join(" ")}
									fill={severityColors[dangerZone.severity]}
									fillOpacity={point ? "0.44" : "0.28"}
									stroke={point ? "#172554" : "#991b1b"}
									strokeWidth={point ? "0.9" : "0.45"}
									aria-label={description}
								>
									<title>{description}</title>
								</polygon>
							);
						})}
						<polyline
							data-testid="route-preview-line"
							points={points}
							fill="none"
							stroke="#ef6c35"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						{checkpoints.map((checkpoint, index) => {
							const [x, y] = fallbackCoordinate(checkpoint.location.coordinates, bounds);
							const description = checkpointDescription(checkpoint);
							const shelter = checkpoint.type === "emergency_shelter";
							return (
								<g
									key={checkpoint.id}
									data-testid={`route-preview-checkpoint-${checkpoint.id}`}
									data-checkpoint-type={checkpoint.type}
									aria-label={description}
								>
									<title>{description}</title>
									{shelter ? (
										<rect
											x={x - 3}
											y={y - 3}
											width="6"
											height="6"
											rx="0.8"
											fill={checkpointMarkerColor(checkpoint.type)}
											stroke="white"
											strokeWidth="0.6"
										/>
									) : (
										<circle
											cx={x}
											cy={y}
											r="3"
											fill={checkpointMarkerColor(checkpoint.type)}
											stroke="white"
											strokeWidth="0.6"
										/>
									)}
									<text
										x={x}
										y={y + 1.1}
										textAnchor="middle"
										fontSize="3.2"
										fontWeight="800"
										fill="white"
									>
										{checkpointMarkerLabel(checkpoint, index)}
									</text>
								</g>
							);
						})}
						{dangerZones.map((dangerZone) => {
							if (dangerZone.geometry.type !== "Point") return null;
							const [x, y] = fallbackCoordinate(dangerZone.geometry.coordinates, bounds);
							const description = dangerZoneDescription(dangerZone);
							return (
								<g
									key={`hazard-marker-${dangerZone.id}`}
									data-testid={`route-preview-hazard-marker-${dangerZone.id}`}
									data-severity={dangerZone.severity}
									aria-label={description}
								>
									<title>{description}</title>
									<circle
										cx={x}
										cy={y}
										r="3.6"
										fill={severityColors[dangerZone.severity]}
										stroke="#172554"
										strokeWidth="0.9"
									/>
									<text
										x={x}
										y={y + 1.35}
										textAnchor="middle"
										fontSize="4.2"
										fontWeight="900"
										fill="white"
									>
										!
									</text>
								</g>
							);
						})}
					</svg>
				)}
				{!styleUrl && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-[#34483b]">
						Đang dùng bản đồ fallback (chưa có MapTiler key).
					</span>
				)}
				{mapError && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
						{mapError}
					</span>
				)}
				{checkpoints.length > 0 && (
					<div
						aria-label="Chú giải checkpoint"
						className="absolute right-3 bottom-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold"
					>
						{checkpointTypes.has("start") && <span>S: Bắt đầu</span>}
						{checkpointTypes.has("finish") && <span>F: Kết thúc</span>}
						{checkpointTypes.has("rest") && <span>Số: Nghỉ chân</span>}
						{checkpointTypes.has("water") && <span className="text-teal-800">W: Nước</span>}
						{checkpointTypes.has("dangerous") && (
							<span className="text-red-700">!: Checkpoint nguy hiểm</span>
						)}
						{checkpointTypes.has("emergency_shelter") && (
							<span className="inline-flex items-center gap-1 text-sky-800">
								<span className="inline-flex size-4 items-center justify-center rounded bg-[#0369a1] text-xs font-extrabold text-white">
									⌂
								</span>
								Nơi trú ẩn
							</span>
						)}
					</div>
				)}
				{dangerZones.length > 0 && (
					<div
						aria-label="Chú giải khu vực nguy hiểm"
						className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold"
					>
						{pointHazard && (
							<span className="inline-flex items-center gap-1 text-[#172554]">
								<span
									className="inline-flex size-5 items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow-[0_0_0_1px_#172554]"
									style={{ backgroundColor: severityColors[pointHazard.severity] }}
								>
									!
								</span>
								Điểm nguy hiểm
							</span>
						)}
						{polygonHazard && (
							<span className="inline-flex items-center gap-1 text-[#991b1b]">
								<span
									className="inline-block size-4 rounded-sm border-2 border-[#991b1b]"
									style={{
										backgroundColor: severityColors[polygonHazard.severity],
										opacity: 0.55,
									}}
								/>
								Khu vực nguy hiểm đa giác
							</span>
						)}
						<span className="text-[#34483b]">Mức độ:</span>
						{dangerZoneSeverities.has("low") && <span className="text-yellow-700">Thấp</span>}
						{dangerZoneSeverities.has("medium") && (
							<span className="text-orange-700">Trung bình</span>
						)}
						{dangerZoneSeverities.has("high") && <span className="text-red-700">Cao</span>}
					</div>
				)}
			</div>
			<div className="mt-3 grid gap-2 text-xs font-bold text-[#667a6d] sm:grid-cols-2">
				<span>Bắt đầu: {geometry.coordinates[0]?.join(", ")}</span>
				<span className="sm:text-right">Kết thúc: {geometry.coordinates.at(-1)?.join(", ")}</span>
			</div>
		</section>
	);
}
