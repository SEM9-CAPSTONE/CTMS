import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { GeoJsonLineString, Position } from "../types";
import {
	addVertex,
	emptyLineString,
	moveVertex,
	removeLastVertex,
	removeVertex,
} from "../utils/route-geometry";
import { approximateLengthMeters } from "../utils/route-import";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

interface Props {
	value: GeoJsonLineString;
	disabled?: boolean;
	onChange: (value: GeoJsonLineString) => void;
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

export function RouteGeometryEditor({ value, disabled = false, onChange }: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const markersRef = useRef<Marker[]>([]);
	const onChangeRef = useRef(onChange);
	const valueRef = useRef(value);
	const disabledRef = useRef(disabled);
	const [selected, setSelected] = useState<number | null>(null);
	const [dragging, setDragging] = useState<number | null>(null);
	const [mapError, setMapError] = useState("");
	const [mapReady, setMapReady] = useState(false);
	const key = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
	const styleUrl = getRouteMapStyleUrl(key);
	const fallback = !styleUrl || Boolean(mapError);

	useEffect(() => {
		onChangeRef.current = onChange;
		valueRef.current = value;
		disabledRef.current = disabled;
	}, [disabled, onChange, value]);

	useEffect(() => {
		if (!styleUrl || !containerRef.current) return;
		let disposed = false;
		void import("maplibre-gl")
			.then((maplibre) => {
				if (disposed || !containerRef.current) return;
				const center = valueRef.current.coordinates[0] ?? DEFAULT_ROUTE_CENTER;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: styleUrl,
					center,
					zoom: 13,
					attributionControl: false,
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
				map.on("load", () => {
					map.addSource("route", {
						type: "geojson",
						data: { type: "Feature", properties: {}, geometry: valueRef.current },
					});
					map.addLayer({
						id: "route-line",
						type: "line",
						source: "route",
						paint: { "line-color": "#ef6c35", "line-width": 5 },
					});
					setMapReady(true);
				});
				map.on("click", (event: MapMouseEvent) => {
					if (!disabledRef.current)
						onChangeRef.current(
							addVertex(valueRef.current, [
								Number(event.lngLat.lng.toFixed(6)),
								Number(event.lngLat.lat.toFixed(6)),
							])
						);
				});
				map.on("error", () =>
					setMapError("Không thể tải MapTiler; trình chỉnh sửa fallback vẫn hoạt động.")
				);
				mapRef.current = map;
			})
			.catch(() => setMapError("Không thể tải MapLibre; trình chỉnh sửa fallback vẫn hoạt động."));
		return () => {
			disposed = true;
			for (const marker of markersRef.current) marker.remove();
			markersRef.current = [];
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [styleUrl]);

	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;
		const source = map.getSource("route") as { setData?: (data: object) => void } | undefined;
		source?.setData?.({ type: "Feature", properties: {}, geometry: value });
		for (const marker of markersRef.current) marker.remove();
		markersRef.current = [];
		void import("maplibre-gl").then((maplibre) => {
			if (mapRef.current !== map) return;
			markersRef.current = value.coordinates.map((position, index) => {
				const element = document.createElement("button");
				element.type = "button";
				element.className = "size-5 rounded-full border-2 border-white bg-[#164027] shadow";
				element.ariaLabel =
					index === 0
						? "Điểm bắt đầu"
						: index === value.coordinates.length - 1
							? "Điểm kết thúc"
							: `Đỉnh ${index + 1}`;
				element.onclick = (event) => {
					event.stopPropagation();
					setSelected(index);
				};
				const marker = new maplibre.Marker({ element, draggable: !disabled })
					.setLngLat(position)
					.addTo(map);
				marker.on("dragend", () => {
					const next = [...valueRef.current.coordinates] as Position[];
					const point = marker.getLngLat();
					next[index] = [Number(point.lng.toFixed(6)), Number(point.lat.toFixed(6))];
					onChangeRef.current({ type: "LineString", coordinates: next });
				});
				return marker;
			});
		});
	}, [disabled, mapReady, value]);

	const updatePosition = (index: number, position: Position) => {
		onChange(moveVertex(value, index, position));
	};
	const removeSelected = () => {
		if (selected === null) return;
		onChange(removeVertex(value, selected));
		setSelected(null);
	};

	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Hình học tuyến đường</h2>
					<p className="text-xs text-[#667a6d]">Click để thêm điểm; kéo điểm để điều chỉnh.</p>
				</div>
				<p
					data-testid="preview-length"
					className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
				>
					≈ {approximateLengthMeters(value.coordinates).toFixed(0)} m · {value.coordinates.length}{" "}
					điểm
				</p>
			</div>
			<div
				ref={containerRef}
				data-testid="route-map-surface"
				className="relative mt-4 h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
			>
				{fallback && (
					<button
						type="button"
						aria-label="Bản đồ vẽ tuyến"
						disabled={disabled}
						className="absolute inset-0 cursor-crosshair"
						onClick={(event) => {
							if (!containerRef.current) return;
							onChange(
								addVertex(
									value,
									pointerPosition(event.clientX, event.clientY, containerRef.current)
								)
							);
						}}
					/>
				)}
				{fallback &&
					value.coordinates.map((position, index) => (
						<button
							key={`${index}-${position.join("-")}`}
							type="button"
							aria-label={
								index === 0
									? "Điểm bắt đầu"
									: index === value.coordinates.length - 1
										? "Điểm kết thúc"
										: `Đỉnh ${index + 1}`
							}
							className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow ${selected === index ? "bg-orange-600 ring-4 ring-orange-200" : "bg-[#164027]"}`}
							style={fallbackPosition(position)}
							onClick={(event) => {
								event.stopPropagation();
								setSelected(index);
							}}
							onPointerDown={(event) => {
								if (!disabled) {
									event.currentTarget.setPointerCapture(event.pointerId);
									setDragging(index);
								}
							}}
							onPointerMove={(event) => {
								if (dragging === index && containerRef.current)
									updatePosition(
										index,
										pointerPosition(event.clientX, event.clientY, containerRef.current)
									);
							}}
							onPointerUp={(event) => {
								if (dragging === index && containerRef.current)
									updatePosition(
										index,
										pointerPosition(event.clientX, event.clientY, containerRef.current)
									);
								setDragging(null);
							}}
						>
							{index === 0 ? "S" : index === value.coordinates.length - 1 ? "E" : index + 1}
						</button>
					))}
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
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					disabled={disabled || selected === null}
					onClick={removeSelected}
					className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				>
					<Trash2 className="mr-1 inline size-4" />
					Xóa điểm đã chọn
				</button>
				<button
					type="button"
					disabled={disabled || value.coordinates.length === 0}
					onClick={() => onChange(removeLastVertex(value))}
					className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				>
					<Undo2 className="mr-1 inline size-4" />
					Xóa điểm cuối
				</button>
				<button
					type="button"
					disabled={disabled || value.coordinates.length === 0}
					onClick={() => {
						onChange(emptyLineString());
						setSelected(null);
					}}
					className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				>
					<RotateCcw className="mr-1 inline size-4" />
					Xóa và vẽ lại
				</button>
				{value.coordinates.length >= 2 && (
					<span className="ml-auto flex items-center gap-1 text-xs font-bold text-[#667a6d]">
						<MapPin className="size-4" />
						S: {value.coordinates[0].join(", ")} · E: {value.coordinates.at(-1)?.join(", ")}
					</span>
				)}
			</div>
		</section>
	);
}
