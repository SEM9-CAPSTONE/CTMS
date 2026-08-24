import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJsonLineString, Position } from "../types";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

interface RouteGeometryPreviewProps {
	geometry: GeoJsonLineString;
}

function fallbackPoints(coordinates: Position[]): string {
	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	const minLongitude = Math.min(...longitudes);
	const maxLongitude = Math.max(...longitudes);
	const minLatitude = Math.min(...latitudes);
	const maxLatitude = Math.max(...latitudes);
	const longitudeRange = maxLongitude - minLongitude || 1;
	const latitudeRange = maxLatitude - minLatitude || 1;

	return coordinates
		.map(([longitude, latitude]) => {
			const x = 8 + ((longitude - minLongitude) / longitudeRange) * 84;
			const y = 92 - ((latitude - minLatitude) / latitudeRange) * 84;
			return `${x},${y}`;
		})
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

export function RouteGeometryPreview({ geometry }: RouteGeometryPreviewProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const geometryRef = useRef(geometry);
	const [mapError, setMapError] = useState("");
	const [mapReady, setMapReady] = useState(false);
	const key = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
	const styleUrl = getRouteMapStyleUrl(key);
	const useFallback = !styleUrl || Boolean(mapError);
	const points = useMemo(() => fallbackPoints(geometry.coordinates), [geometry.coordinates]);

	useEffect(() => {
		geometryRef.current = geometry;
	}, [geometry]);

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
					fitRoute(map, geometryRef.current.coordinates);
					setMapReady(true);
				});
				map.on("error", () => setMapError("Không thể tải MapTiler; đang dùng bản đồ fallback."));
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải MapLibre; đang dùng bản đồ fallback."));

		return () => {
			disposed = true;
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
		fitRoute(map, geometry.coordinates);
	}, [geometry, mapReady]);

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
						<polyline
							data-testid="route-preview-line"
							points={points}
							fill="none"
							stroke="#ef6c35"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
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
			</div>
			<div className="mt-3 grid gap-2 text-xs font-bold text-[#667a6d] sm:grid-cols-2">
				<span>Bắt đầu: {geometry.coordinates[0]?.join(", ")}</span>
				<span className="sm:text-right">Kết thúc: {geometry.coordinates.at(-1)?.join(", ")}</span>
			</div>
		</section>
	);
}
