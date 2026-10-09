import "maplibre-gl/dist/maplibre-gl.css";
import { Lock } from "lucide-react";
import type { Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CreatedTrekkingRoute, Position, RouteCheckpoint } from "../../trekking-routes/types";
import { approximateLengthMeters } from "../../trekking-routes/utils/route-import";
import { DEFAULT_ROUTE_CENTER } from "../../trekking-routes/utils/route-map";
import { getRouteMapStyleUrl } from "../../trekking-routes/utils/route-map";
import type { ConfigureTripWaypointFormItem } from "../schema/configure-trip-waypoints.schema";
import type { TripWaypointType } from "../types";

interface TripWaypointLocationMapProps {
	route?: CreatedTrekkingRoute | null;
	checkpoints: RouteCheckpoint[];
	waypoints: ConfigureTripWaypointFormItem[];
	activeIndex: number;
	disabled?: boolean;
	editor?: ReactNode;
	onActiveIndexChange: (index: number) => void;
	onRouteNodeSelect: (position: Position, routeOrder: number) => void;
	onWaypointMove: (index: number, position: Position, routeOrder: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface ViewBounds {
	minLongitude: number;
	maxLongitude: number;
	minLatitude: number;
	maxLatitude: number;
}

function getViewBounds(points: Position[]): ViewBounds {
	const usablePoints = points.length > 0 ? points : [DEFAULT_ROUTE_CENTER];
	const longitudes = usablePoints.map((point) => point[0]);
	const latitudes = usablePoints.map((point) => point[1]);
	const minLongitude = Math.min(...longitudes);
	const maxLongitude = Math.max(...longitudes);
	const minLatitude = Math.min(...latitudes);
	const maxLatitude = Math.max(...latitudes);
	const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.18, 0.001);
	const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.18, 0.001);
	return {
		minLongitude: minLongitude - longitudePadding,
		maxLongitude: maxLongitude + longitudePadding,
		minLatitude: minLatitude - latitudePadding,
		maxLatitude: maxLatitude + latitudePadding,
	};
}

function fallbackPosition([longitude, latitude]: Position, bounds: ViewBounds) {
	const longitudeSpan = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.001);
	const latitudeSpan = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.001);
	return {
		left: `${clamp(((longitude - bounds.minLongitude) / longitudeSpan) * 100, 2, 98)}%`,
		top: `${clamp(((bounds.maxLatitude - latitude) / latitudeSpan) * 100, 2, 98)}%`,
	};
}

function fallbackPolyline(coordinates: Position[], bounds: ViewBounds) {
	return coordinates
		.map((coordinate) => {
			const position = fallbackPosition(coordinate, bounds);
			return `${position.left.replace("%", "")},${position.top.replace("%", "")}`;
		})
		.join(" ");
}

function toPosition(waypoint: ConfigureTripWaypointFormItem): Position | null {
	if (!waypoint.longitude?.trim() || !waypoint.latitude?.trim()) return null;
	const longitude = Number(waypoint.longitude);
	const latitude = Number(waypoint.latitude);
	if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
	return [longitude, latitude];
}

function routeOrderOf(waypoint: ConfigureTripWaypointFormItem): number {
	const routeOrder = Number(waypoint.routeOrder);
	if (Number.isFinite(routeOrder)) return routeOrder;
	return Number.MAX_SAFE_INTEGER;
}

function isFixedEndpoint(waypoint: ConfigureTripWaypointFormItem | TripWaypointType): boolean {
	const type = typeof waypoint === "string" ? waypoint : waypoint.type;
	return type === "start" || type === "finish";
}

function pointDistance(first: Position, second: Position): number {
	return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function nearestPointOnSegment(position: Position, start: Position, finish: Position) {
	const segmentLongitude = finish[0] - start[0];
	const segmentLatitude = finish[1] - start[1];
	const segmentLengthSquared = segmentLongitude ** 2 + segmentLatitude ** 2;
	if (segmentLengthSquared === 0) return { point: start, ratio: 0, distanceSquared: 0 };
	const ratio = clamp(
		((position[0] - start[0]) * segmentLongitude + (position[1] - start[1]) * segmentLatitude) /
			segmentLengthSquared,
		0,
		1
	);
	const point: Position = [
		Number((start[0] + segmentLongitude * ratio).toFixed(6)),
		Number((start[1] + segmentLatitude * ratio).toFixed(6)),
	];
	return {
		point,
		ratio,
		distanceSquared: (position[0] - point[0]) ** 2 + (position[1] - point[1]) ** 2,
	};
}

function nearestRoutePoint(
	position: Position,
	coordinates: Position[]
): { position: Position; routeOrder: number } {
	if (coordinates.length === 0) return { position, routeOrder: 0 };
	if (coordinates.length === 1) return { position: coordinates[0], routeOrder: 0 };
	const segmentLengths = coordinates
		.slice(0, -1)
		.map((coordinate, index) => pointDistance(coordinate, coordinates[index + 1]));
	const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
	let lengthBeforeSegment = 0;
	let bestLengthBeforeSegment = 0;
	let bestSegmentLength = segmentLengths[0] || 0;
	let bestRatio = 0;
	let nearestPosition = coordinates[0];
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < coordinates.length - 1; index += 1) {
		const projection = nearestPointOnSegment(position, coordinates[index], coordinates[index + 1]);
		if (projection.distanceSquared < nearestDistance) {
			nearestDistance = projection.distanceSquared;
			nearestPosition = projection.point;
			bestRatio = projection.ratio;
			bestSegmentLength = segmentLengths[index] || 0;
			bestLengthBeforeSegment = lengthBeforeSegment;
		}
		lengthBeforeSegment += segmentLengths[index] || 0;
	}
	const routeOrder =
		totalLength > 0 ? (bestLengthBeforeSegment + bestSegmentLength * bestRatio) / totalLength : 0;
	return {
		position: nearestPosition,
		routeOrder: Number(routeOrder.toFixed(6)),
	};
}

function positionFromFallbackPointer(
	clientX: number,
	clientY: number,
	element: HTMLDivElement,
	bounds: ViewBounds
): Position {
	const rect = element.getBoundingClientRect();
	if (!rect.width || !rect.height) return DEFAULT_ROUTE_CENTER;
	const longitudeSpan = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.001);
	const latitudeSpan = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.001);
	const x = clamp((clientX - rect.left) / rect.width, 0, 1);
	const y = clamp((clientY - rect.top) / rect.height, 0, 1);
	return [
		Number((bounds.minLongitude + longitudeSpan * x).toFixed(6)),
		Number((bounds.maxLatitude - latitudeSpan * y).toFixed(6)),
	];
}

function canUseMapLibre(): boolean {
	if (typeof window === "undefined") return false;
	if (window.navigator.userAgent.toLowerCase().includes("jsdom")) return false;
	try {
		const canvas = document.createElement("canvas");
		return Boolean(canvas.getContext("webgl2"));
	} catch {
		return false;
	}
}

function fitRoute(map: MapLibreMap, coordinates: Position[]): void {
	if (coordinates.length === 0) return;
	void import("maplibre-gl").then((maplibre) => {
		const bounds = new maplibre.LngLatBounds(coordinates[0], coordinates[0]);
		for (const coordinate of coordinates) bounds.extend(coordinate);
		map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
	});
}

export function TripWaypointLocationMap({
	route,
	checkpoints,
	waypoints,
	activeIndex,
	disabled = false,
	editor,
	onActiveIndexChange,
	onRouteNodeSelect,
	onWaypointMove,
}: TripWaypointLocationMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const markerRefs = useRef<Marker[]>([]);
	const routeRef = useRef(route);
	const waypointsRef = useRef(waypoints);
	const activeIndexRef = useRef(activeIndex);
	const disabledRef = useRef(disabled);
	const onActiveIndexChangeRef = useRef(onActiveIndexChange);
	const onRouteNodeSelectRef = useRef(onRouteNodeSelect);
	const onWaypointMoveRef = useRef(onWaypointMove);
	const [mapReady, setMapReady] = useState(false);
	const [mapError, setMapError] = useState("");
	const [activeOverlayPosition, setActiveOverlayPosition] = useState<{
		left: string;
		top: string;
	} | null>(null);
	const styleUrl = getRouteMapStyleUrl(import.meta.env.VITE_MAPTILER_API_KEY as string | undefined);
	const coordinates = useMemo(
		() => route?.geometry.coordinates ?? [],
		[route?.geometry.coordinates]
	);
	const activeWaypoint = waypoints[activeIndex];
	const activePosition = activeWaypoint ? toPosition(activeWaypoint) : null;
	const sortedWaypoints = useMemo(
		() =>
			[...waypoints]
				.map((waypoint, index) => ({ waypoint, index }))
				.sort((first, second) => routeOrderOf(first.waypoint) - routeOrderOf(second.waypoint)),
		[waypoints]
	);
	const waypointPositions = useMemo(
		() => waypoints.map(toPosition).filter((position): position is Position => Boolean(position)),
		[waypoints]
	);
	const checkpointPositions = useMemo(
		() => checkpoints.map((checkpoint) => checkpoint.location.coordinates),
		[checkpoints]
	);
	const bounds = useMemo(
		() => getViewBounds([...coordinates, ...checkpointPositions, ...waypointPositions]),
		[checkpointPositions, coordinates, waypointPositions]
	);
	const startLocked = activeWaypoint?.type === "start";
	const finishLocked = activeWaypoint?.type === "finish";
	const isActiveLocked = Boolean(activeWaypoint && isFixedEndpoint(activeWaypoint));
	const start = coordinates[0] ?? null;
	const finish = coordinates.at(-1) ?? null;
	const useFallback = !styleUrl || Boolean(mapError);
	const activeScreenPosition = activePosition
		? !useFallback && activeOverlayPosition
			? activeOverlayPosition
			: fallbackPosition(activePosition, bounds)
		: null;
	const activeLeft = activeScreenPosition ? Number(activeScreenPosition.left.replace("%", "")) : 50;
	const activeTop = activeScreenPosition ? Number(activeScreenPosition.top.replace("%", "")) : 50;
	const editorOnRight = activeLeft < 58;
	const editorLeft = editorOnRight ? Math.min(activeLeft + 8, 68) : Math.max(activeLeft - 38, 4);
	const editorAnchoredToBottom = activeTop > 42;
	const editorTop = editorAnchoredToBottom ? 0 : clamp(activeTop - 12, 3, 28);
	const connectorStartX = activeLeft;
	const connectorStartY = activeTop;
	const connectorEndX = editorOnRight ? editorLeft : editorLeft + 30;
	const connectorEndY = editorAnchoredToBottom ? 78 : editorTop + 24;
	const editorPositionStyle = editorAnchoredToBottom
		? { left: `${editorLeft}%`, bottom: "1rem" }
		: { left: `${editorLeft}%`, top: `${editorTop}%` };

	useEffect(() => {
		routeRef.current = route;
		waypointsRef.current = waypoints;
		activeIndexRef.current = activeIndex;
		disabledRef.current = disabled;
		onActiveIndexChangeRef.current = onActiveIndexChange;
		onRouteNodeSelectRef.current = onRouteNodeSelect;
		onWaypointMoveRef.current = onWaypointMove;
	}, [
		activeIndex,
		disabled,
		onActiveIndexChange,
		onRouteNodeSelect,
		onWaypointMove,
		route,
		waypoints,
	]);

	useEffect(() => {
		if (!styleUrl || !containerRef.current) return;
		if (!canUseMapLibre()) {
			setMapError("Thiết bị không hỗ trợ bản đồ nền; bản đồ dự phòng vẫn hoạt động.");
			return;
		}
		let disposed = false;
		void import("maplibre-gl")
			.then((maplibre) => {
				if (disposed || !containerRef.current) return;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: styleUrl,
					center: routeRef.current?.geometry.coordinates[0] ?? DEFAULT_ROUTE_CENTER,
					zoom: 13,
					attributionControl: false,
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
				map.on("load", () => {
					map.addSource("trip-waypoint-route", {
						type: "geojson",
						data: {
							type: "Feature",
							properties: {},
							geometry: routeRef.current?.geometry ?? {
								type: "LineString",
								coordinates: [],
							},
						},
					});
					map.addLayer({
						id: "trip-waypoint-route-line",
						type: "line",
						source: "trip-waypoint-route",
						paint: { "line-color": "#ef6c35", "line-width": 5 },
					});
					fitRoute(map, routeRef.current?.geometry.coordinates ?? []);
					setMapReady(true);
				});
				map.on("click", (event: MapMouseEvent) => {
					const routeCoordinates = routeRef.current?.geometry.coordinates ?? [];
					if (disabledRef.current || routeCoordinates.length === 0) return;
					const snapped = nearestRoutePoint(
						[Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))],
						routeCoordinates
					);
					onRouteNodeSelectRef.current(snapped.position, snapped.routeOrder);
				});
				map.on("error", () =>
					setMapError("Không thể tải bản đồ nền; bản đồ dự phòng vẫn hoạt động.")
				);
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải bản đồ; bản đồ dự phòng vẫn hoạt động."));
		return () => {
			disposed = true;
			for (const marker of markerRefs.current) marker.remove();
			markerRefs.current = [];
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [styleUrl]);

	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;
		const source = map.getSource("trip-waypoint-route") as
			| { setData?: (data: object) => void }
			| undefined;
		source?.setData?.({
			type: "Feature",
			properties: {},
			geometry: route?.geometry ?? { type: "LineString", coordinates: [] },
		});
		fitRoute(map, coordinates);
	}, [coordinates, mapReady, route?.geometry]);

	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;
		for (const marker of markerRefs.current) marker.remove();
		markerRefs.current = [];
		void import("maplibre-gl").then((maplibre) => {
			if (mapRef.current !== map) return;
			coordinates.forEach((coordinate, routeOrder) => {
				const isEndpoint = routeOrder === 0 || routeOrder === coordinates.length - 1;
				const element = document.createElement("button");
				element.type = "button";
				element.disabled = disabled || isEndpoint;
				element.className = isEndpoint
					? "size-7 cursor-not-allowed rounded-full border-2 border-white bg-[#164027] shadow"
					: "size-4 rounded-full border-2 border-white bg-white shadow hover:bg-[#164027]";
				element.setAttribute(
					"aria-label",
					isEndpoint
						? routeOrder === 0
							? "Điểm bắt đầu cố định"
							: "Điểm kết thúc cố định"
						: `Chọn vị trí tuyến ${routeOrder + 1}`
				);
				element.addEventListener("click", (event) => {
					event.stopPropagation();
					if (disabledRef.current || isEndpoint) return;
					onRouteNodeSelectRef.current(
						coordinate,
						Number((routeOrder / Math.max(coordinates.length - 1, 1)).toFixed(6))
					);
				});
				markerRefs.current.push(new maplibre.Marker({ element }).setLngLat(coordinate).addTo(map));
			});
			for (const checkpoint of checkpoints) {
				const element = document.createElement("button");
				element.type = "button";
				element.className =
					"flex size-7 items-center justify-center rounded-full border-2 border-white bg-sky-700 text-[10px] font-black text-white shadow";
				element.textContent = "C";
				element.title = checkpoint.name;
				element.addEventListener("click", (event) => {
					event.stopPropagation();
					if (disabledRef.current) return;
					const snapped = nearestRoutePoint(checkpoint.location.coordinates, coordinates);
					onRouteNodeSelectRef.current(snapped.position, snapped.routeOrder);
				});
				markerRefs.current.push(
					new maplibre.Marker({ element }).setLngLat(checkpoint.location.coordinates).addTo(map)
				);
			}
			waypoints.forEach((waypoint, index) => {
				const position = toPosition(waypoint);
				if (!position) return;
				const element = document.createElement("button");
				element.type = "button";
				const sortedIndex = sortedWaypoints.findIndex((item) => item.index === index);
				const lockedWaypoint = isFixedEndpoint(waypoint);
				element.className = `flex size-9 items-center justify-center rounded-full border-4 border-white shadow-lg ${
					index === activeIndex ? "bg-[#164027] text-white" : "bg-white text-[#164027]"
				} ${lockedWaypoint || disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`;
				element.textContent = lockedWaypoint ? "" : String(sortedIndex + 1);
				if (lockedWaypoint) {
					element.innerHTML =
						'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
				}
				element.addEventListener("click", (event) => {
					event.stopPropagation();
					onActiveIndexChangeRef.current(index);
				});
				const marker = new maplibre.Marker({
					element,
					draggable: !disabled && !lockedWaypoint,
				})
					.setLngLat(position)
					.addTo(map);
				if (!disabled && !lockedWaypoint) {
					marker.on("dragend", () => {
						const lngLat = marker.getLngLat();
						const snapped = nearestRoutePoint(
							[Number(lngLat.lng.toFixed(6)), Number(lngLat.lat.toFixed(6))],
							coordinates
						);
						marker.setLngLat(snapped.position);
						onWaypointMoveRef.current(index, snapped.position, snapped.routeOrder);
					});
				}
				markerRefs.current.push(marker);
			});
		});
	}, [activeIndex, checkpoints, coordinates, disabled, mapReady, sortedWaypoints, waypoints]);

	useEffect(() => {
		if (useFallback || !mapReady || !activePosition) {
			setActiveOverlayPosition(null);
			return;
		}
		const map = mapRef.current;
		const element = containerRef.current;
		if (!map || !element) return;
		const updateOverlayPosition = () => {
			const point = map.project(activePosition);
			const width = Math.max(element.clientWidth, 1);
			const height = Math.max(element.clientHeight, 1);
			const nextPosition = {
				left: `${clamp((point.x / width) * 100, 2, 98)}%`,
				top: `${clamp((point.y / height) * 100, 2, 98)}%`,
			};
			setActiveOverlayPosition((currentPosition) =>
				currentPosition?.left === nextPosition.left && currentPosition?.top === nextPosition.top
					? currentPosition
					: nextPosition
			);
		};
		updateOverlayPosition();
		map.on("move", updateOverlayPosition);
		map.on("zoom", updateOverlayPosition);
		return () => {
			map.off("move", updateOverlayPosition);
			map.off("zoom", updateOverlayPosition);
		};
	}, [activePosition, mapReady, useFallback]);

	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 className="font-extrabold text-[#10221b]">Chọn điểm dừng trên bản đồ</h3>
				</div>
				<div className="flex flex-col items-start gap-2 sm:items-end">
					{route && (
						<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
							≈ {approximateLengthMeters(coordinates).toFixed(0)} m · {coordinates.length} điểm
						</span>
					)}
				</div>
			</div>
			<div
				ref={containerRef}
				data-testid="trip-waypoint-location-map"
				data-map-mode={useFallback ? "fallback" : mapReady ? "maplibre" : "loading"}
				className="relative mt-4 h-[420px] overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
				onKeyDown={(event) => {
					if (disabled || isActiveLocked || event.key !== "Enter" || !activeWaypoint) return;
					onRouteNodeSelect(activePosition ?? DEFAULT_ROUTE_CENTER, routeOrderOf(activeWaypoint));
				}}
				onClick={(event) => {
					if (!useFallback || disabled || coordinates.length === 0 || !containerRef.current) return;
					const pointerPosition = positionFromFallbackPointer(
						event.clientX,
						event.clientY,
						containerRef.current,
						bounds
					);
					const snapped = nearestRoutePoint(pointerPosition, coordinates);
					onRouteNodeSelect(snapped.position, snapped.routeOrder);
				}}
				// biome-ignore lint/a11y/useSemanticElements: The map surface contains nested controls and cannot be a native button.
				role="button"
				tabIndex={disabled ? -1 : 0}
				aria-label="Chọn điểm dừng trên bản đồ"
			>
				{useFallback && coordinates.length > 1 && (
					<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
						<polyline
							points={fallbackPolyline(coordinates, bounds)}
							fill="none"
							stroke="#ef6c35"
							strokeWidth="5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
				{useFallback &&
					coordinates.map((coordinate, routeOrder) => {
						const isEndpoint = routeOrder === 0 || routeOrder === coordinates.length - 1;
						return (
							<button
								key={`${coordinate.join(",")}-${routeOrder}`}
								type="button"
								disabled={disabled || isEndpoint}
								onClick={(event) => {
									event.stopPropagation();
									if (disabled || isEndpoint) return;
									onRouteNodeSelect(
										coordinate,
										Number((routeOrder / (coordinates.length - 1)).toFixed(6))
									);
								}}
								className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 rounded-full border-2 border-white shadow ${
									isEndpoint
										? "size-7 cursor-not-allowed bg-[#164027]"
										: "size-4 bg-white hover:bg-[#164027]"
								}`}
								style={fallbackPosition(coordinate, bounds)}
								aria-label={
									isEndpoint
										? routeOrder === 0
											? "Điểm bắt đầu cố định"
											: "Điểm kết thúc cố định"
										: `Chọn vị trí tuyến ${routeOrder + 1}`
								}
							/>
						);
					})}
				{useFallback &&
					checkpoints.map((checkpoint) => (
						<button
							key={checkpoint.id}
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								if (disabled) return;
								const snapped = nearestRoutePoint(checkpoint.location.coordinates, coordinates);
								onRouteNodeSelect(snapped.position, snapped.routeOrder);
							}}
							className="-translate-x-1/2 -translate-y-1/2 absolute z-20 flex size-7 items-center justify-center rounded-full border-2 border-white bg-sky-700 text-[10px] font-black text-white shadow"
							style={fallbackPosition(checkpoint.location.coordinates, bounds)}
							title={checkpoint.name}
						>
							C
						</button>
					))}
				{useFallback &&
					waypoints.map((waypoint, index) => {
						const position = toPosition(waypoint);
						if (!position) return null;
						const isActive = index === activeIndex;
						const sortedIndex = sortedWaypoints.findIndex((item) => item.index === index);
						return (
							<button
								key={`${waypoint.type}-${index}-marker`}
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onActiveIndexChange(index);
								}}
								className={`-translate-x-1/2 -translate-y-1/2 absolute z-30 flex size-9 items-center justify-center rounded-full border-4 border-white shadow-lg ${
									isActive ? "bg-[#164027] text-white" : "bg-white text-[#164027]"
								}`}
								style={fallbackPosition(position, bounds)}
								aria-label={`Chọn điểm dừng ${index + 1}`}
							>
								{isFixedEndpoint(waypoint) ? <Lock className="size-4" /> : sortedIndex + 1}
							</button>
						);
					})}
				{!route && (
					<div className="absolute inset-0 flex items-center justify-center bg-white/70 p-6 text-center">
						<p className="max-w-sm text-sm font-bold text-[#667a6d]">
							Chưa tải được tuyến gốc. Bạn vẫn có thể chọn vị trí trên bản đồ dự phòng.
						</p>
					</div>
				)}
				{!styleUrl && route && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-[#34483b]">
						Đang dùng bản đồ dự phòng.
					</span>
				)}
				{mapError && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
						{mapError}
					</span>
				)}
				{editor && activePosition && (
					<>
						<svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-40 size-full">
							<line
								x1={`${connectorStartX}%`}
								y1={`${connectorStartY}%`}
								x2={`${connectorEndX}%`}
								y2={`${connectorEndY}%`}
								stroke="#dce8dd"
								strokeWidth="1"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						</svg>
						<div
							className="absolute z-50 w-[min(320px,calc(100%-2rem))] overflow-visible rounded-2xl border border-[#dce8dd] bg-white/95 p-4 text-[#10221b] shadow-2xl backdrop-blur"
							style={editorPositionStyle}
						>
							{editor}
						</div>
					</>
				)}
			</div>
			<div className="mt-3 grid gap-2 text-xs font-bold text-[#667a6d] sm:grid-cols-3">
				<p>Điểm bắt đầu: {start ? start.join(", ") : "Chưa có tuyến"}</p>
				<p>Điểm kết thúc: {finish ? finish.join(", ") : "Chưa có tuyến"}</p>
				<p>
					Điểm đang chọn:{" "}
					{activePosition
						? `${activePosition[0].toFixed(6)}, ${activePosition[1].toFixed(6)}`
						: startLocked
							? "Điểm bắt đầu cố định"
							: finishLocked
								? "Điểm kết thúc cố định"
								: "Chưa chọn"}
				</p>
			</div>
		</section>
	);
}
