import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import type { Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { CreatedTrekkingRoute, Position } from "../../trekking-routes/types";
import { approximateLengthMeters } from "../../trekking-routes/utils/route-import";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../../trekking-routes/utils/route-map";

interface TripRouteMapProps {
	route: CreatedTrekkingRoute | null;
	meetingPoint: Position;
	disabled?: boolean;
	onMeetingPointChange: (position: Position) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function pointerPosition(clientX: number, clientY: number, element: HTMLDivElement): Position {
	const rect = element.getBoundingClientRect();
	if (!rect.width || !rect.height) return DEFAULT_ROUTE_CENTER;
	return [
		Number((-180 + clamp((clientX - rect.left) / rect.width, 0, 1) * 360).toFixed(6)),
		Number((90 - clamp((clientY - rect.top) / rect.height, 0, 1) * 180).toFixed(6)),
	];
}

function fallbackPosition([longitude, latitude]: Position) {
	return { left: `${((longitude + 180) / 360) * 100}%`, top: `${((90 - latitude) / 180) * 100}%` };
}

function fallbackPolyline(coordinates: Position[]) {
	return coordinates
		.map(
			([longitude, latitude]) =>
				`${((longitude + 180) / 360) * 100},${((90 - latitude) / 180) * 100}`
		)
		.join(" ");
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

export function TripRouteMap({
	route,
	meetingPoint,
	disabled = false,
	onMeetingPointChange,
}: TripRouteMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const markerRef = useRef<Marker | null>(null);
	const routeRef = useRef(route);
	const meetingPointRef = useRef(meetingPoint);
	const disabledRef = useRef(disabled);
	const onMeetingPointChangeRef = useRef(onMeetingPointChange);
	const [mapReady, setMapReady] = useState(false);
	const [mapError, setMapError] = useState("");
	const key = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
	const styleUrl = getRouteMapStyleUrl(key);
	const fallback = !styleUrl || Boolean(mapError);
	const coordinates = route?.geometry.coordinates ?? [];
	const start = coordinates[0] ?? null;
	const finish = coordinates.at(-1) ?? null;

	useEffect(() => {
		routeRef.current = route;
		meetingPointRef.current = meetingPoint;
		disabledRef.current = disabled;
		onMeetingPointChangeRef.current = onMeetingPointChange;
	}, [disabled, meetingPoint, onMeetingPointChange, route]);

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
				const center = routeRef.current?.geometry.coordinates[0] ?? meetingPointRef.current;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: styleUrl,
					center,
					zoom: 13,
					attributionControl: false,
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
				map.on("load", () => {
					map.addSource("trip-route", {
						type: "geojson",
						data: {
							type: "Feature",
							properties: {},
							geometry: routeRef.current?.geometry ?? { type: "LineString", coordinates: [] },
						},
					});
					map.addLayer({
						id: "trip-route-line",
						type: "line",
						source: "trip-route",
						paint: { "line-color": "#ef6c35", "line-width": 5 },
					});
					setMapReady(true);
				});
				map.on("click", (event: MapMouseEvent) => {
					if (disabledRef.current) return;
					onMeetingPointChangeRef.current([
						Number(event.lngLat.lng.toFixed(6)),
						Number(event.lngLat.lat.toFixed(6)),
					]);
				});
				map.on("error", () =>
					setMapError("Không thể tải bản đồ nền; bản đồ dự phòng vẫn hoạt động.")
				);
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải bản đồ; bản đồ dự phòng vẫn hoạt động."));
		return () => {
			disposed = true;
			markerRef.current?.remove();
			markerRef.current = null;
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [styleUrl]);

	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;
		const source = map.getSource("trip-route") as { setData?: (data: object) => void } | undefined;
		source?.setData?.({
			type: "Feature",
			properties: {},
			geometry: route?.geometry ?? { type: "LineString", coordinates: [] },
		});
		void import("maplibre-gl").then((maplibre) => {
			if (mapRef.current !== map) return;
			if (!markerRef.current) {
				const element = document.createElement("div");
				element.className = "size-6 rounded-full border-4 border-white bg-[#164027] shadow-lg";
				markerRef.current = new maplibre.Marker({ element, draggable: !disabled })
					.setLngLat(meetingPoint)
					.addTo(map);
				markerRef.current.on("dragend", () => {
					const point = markerRef.current?.getLngLat();
					if (!point) return;
					onMeetingPointChangeRef.current([
						Number(point.lng.toFixed(6)),
						Number(point.lat.toFixed(6)),
					]);
				});
			}
			markerRef.current.setLngLat(meetingPoint);
		});
		if (route?.geometry.coordinates[0]) map.setCenter(route.geometry.coordinates[0]);
	}, [disabled, mapReady, meetingPoint, route]);

	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Tuyến và điểm tập trung</h2>
					<p className="text-sm text-[#667a6d]">
						Chọn tuyến có sẵn, sau đó click trên bản đồ để đặt điểm tập trung.
					</p>
				</div>
				{route && (
					<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
						≈ {approximateLengthMeters(coordinates).toFixed(0)} m · {coordinates.length} điểm
					</span>
				)}
			</div>
			<div
				ref={containerRef}
				data-testid="trip-route-map"
				className="relative mt-4 h-[420px] overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
			>
				{fallback && (
					<button
						type="button"
						aria-label="Chọn điểm tập trung trên bản đồ"
						disabled={disabled || !route}
						className="absolute inset-0 cursor-crosshair disabled:cursor-not-allowed"
						onClick={(event) => {
							if (!containerRef.current) return;
							onMeetingPointChange(
								pointerPosition(event.clientX, event.clientY, containerRef.current)
							);
						}}
					/>
				)}
				{fallback && coordinates.length > 1 && (
					<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
						<polyline
							points={fallbackPolyline(coordinates)}
							fill="none"
							stroke="#ef6c35"
							strokeWidth="5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
				{fallback && start && (
					<span
						className="-translate-x-1/2 -translate-y-1/2 absolute z-10 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#164027] text-xs font-black text-white shadow"
						style={fallbackPosition(start)}
					>
						S
					</span>
				)}
				{fallback && finish && (
					<span
						className="-translate-x-1/2 -translate-y-1/2 absolute z-10 flex size-8 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-xs font-black text-white shadow"
						style={fallbackPosition(finish)}
					>
						E
					</span>
				)}
				{fallback && route && (
					<span
						className="-translate-x-1/2 -translate-y-1/2 absolute z-20 flex size-9 items-center justify-center rounded-full border-4 border-white bg-sky-700 text-white shadow-lg"
						style={fallbackPosition(meetingPoint)}
					>
						<MapPin className="size-4" />
					</span>
				)}
				{!route && (
					<div className="absolute inset-0 flex items-center justify-center bg-white/70 p-6 text-center">
						<p className="max-w-sm text-sm font-bold text-[#667a6d]">
							Chọn một tuyến trekking đã duyệt để xem đường đi và đặt điểm tập trung.
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
			</div>
			<div className="mt-3 grid gap-2 text-xs font-bold text-[#667a6d] sm:grid-cols-3">
				<p>Điểm bắt đầu: {start ? start.join(", ") : "Chưa có tuyến"}</p>
				<p>Điểm kết thúc: {finish ? finish.join(", ") : "Chưa có tuyến"}</p>
				<p>Điểm tập trung: {route ? meetingPoint.join(", ") : "Chưa chọn"}</p>
			</div>
		</section>
	);
}
