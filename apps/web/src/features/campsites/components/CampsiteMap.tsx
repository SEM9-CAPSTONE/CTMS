import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import type { Map as MapLibreMap, Marker as MapLibreMarker, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { CampsiteLocationState } from "../types";

interface CampsiteMapProps {
	value: CampsiteLocationState;
	disabled?: boolean;
	onPick: (latitude: number, longitude: number) => void;
}

const DEFAULT_LATITUDE = 11.940419;
const DEFAULT_LONGITUDE = 108.458313;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function pointToCoordinates(clientX: number, clientY: number, element: HTMLDivElement) {
	const rect = element.getBoundingClientRect();
	if (rect.width === 0 || rect.height === 0) {
		return {
			latitude: DEFAULT_LATITUDE,
			longitude: DEFAULT_LONGITUDE,
		};
	}

	const x = clamp((clientX - rect.left) / rect.width, 0, 1);
	const y = clamp((clientY - rect.top) / rect.height, 0, 1);

	return {
		latitude: Number((90 - y * 180).toFixed(6)),
		longitude: Number((-180 + x * 360).toFixed(6)),
	};
}

function coordinatesToMarkerPosition(value: CampsiteLocationState) {
	const latitude = value.latitude ?? DEFAULT_LATITUDE;
	const longitude = value.longitude ?? DEFAULT_LONGITUDE;

	return {
		left: `${((longitude + 180) / 360) * 100}%`,
		top: `${((90 - latitude) / 180) * 100}%`,
	};
}

export default function CampsiteMap({ value, disabled = false, onPick }: CampsiteMapProps) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<MapLibreMap | null>(null);
	const markerRef = useRef<MapLibreMarker | null>(null);
	const disabledRef = useRef(disabled);
	const onPickRef = useRef(onPick);
	const valueRef = useRef(value);
	const [isDragging, setIsDragging] = useState(false);
	const [mapError, setMapError] = useState("");
	const hasLocation = value.latitude !== null && value.longitude !== null;
	const markerPosition = coordinatesToMarkerPosition(value);
	const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
	const styleUrl = mapTilerKey
		? `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${mapTilerKey}`
		: "";
	const shouldUseFallback = !styleUrl || Boolean(mapError);

	useEffect(() => {
		disabledRef.current = disabled;
		onPickRef.current = onPick;
		valueRef.current = value;
	}, [disabled, onPick, value]);

	useEffect(() => {
		if (!styleUrl || !mapRef.current) {
			return undefined;
		}

		let isDisposed = false;
		const initialLatitude = valueRef.current.latitude ?? DEFAULT_LATITUDE;
		const initialLongitude = valueRef.current.longitude ?? DEFAULT_LONGITUDE;

		void import("maplibre-gl")
			.then((module) => {
				if (isDisposed || !mapRef.current) {
					return;
				}

				const maplibregl = module;
				const map = new maplibregl.Map({
					container: mapRef.current,
					style: styleUrl,
					center: [initialLongitude, initialLatitude],
					zoom: 13,
					attributionControl: false,
				});
				const marker = new maplibregl.Marker({ draggable: true })
					.setLngLat([initialLongitude, initialLatitude])
					.addTo(map);

				map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
				map.on("click", (event: MapMouseEvent) => {
					if (!disabledRef.current) {
						onPickRef.current(
							Number(event.lngLat.lat.toFixed(6)),
							Number(event.lngLat.lng.toFixed(6))
						);
					}
				});
				map.on("error", () => {
					setMapError("Không thể tải bản đồ MapTiler. Bạn vẫn có thể chọn vị trí bằng fallback.");
				});
				marker.on("dragend", () => {
					if (disabledRef.current) {
						return;
					}

					const nextLocation = marker.getLngLat();
					onPickRef.current(
						Number(nextLocation.lat.toFixed(6)),
						Number(nextLocation.lng.toFixed(6))
					);
				});

				mapInstanceRef.current = map;
				markerRef.current = marker;
			})
			.catch(() => {
				setMapError("Không thể tải MapLibre. Bạn vẫn có thể chọn vị trí bằng fallback.");
			});

		return () => {
			isDisposed = true;
			markerRef.current?.remove();
			mapInstanceRef.current?.remove();
			markerRef.current = null;
			mapInstanceRef.current = null;
		};
	}, [styleUrl]);

	useEffect(() => {
		if (value.latitude === null || value.longitude === null) {
			return;
		}

		markerRef.current?.setLngLat([value.longitude, value.latitude]);
		mapInstanceRef.current?.flyTo({
			center: [value.longitude, value.latitude],
			zoom: 13,
			essential: true,
		});
	}, [value.latitude, value.longitude]);

	const pickFromPointer = (clientX: number, clientY: number) => {
		if (!mapRef.current || disabled || !shouldUseFallback) {
			return;
		}

		const nextLocation = pointToCoordinates(clientX, clientY, mapRef.current);
		onPick(nextLocation.latitude, nextLocation.longitude);
	};

	return (
		<div>
			<div
				ref={mapRef}
				className="relative h-72 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd_0%,#f7faf5_48%,#cfe3da_100%)] outline-none focus:ring-2 focus:ring-[#164027]/20"
			>
				{shouldUseFallback && (
					<>
						<div className="absolute inset-x-0 top-12 h-px bg-white/70" />
						<div className="absolute inset-y-0 left-1/3 w-px bg-white/70" />
						<div className="absolute inset-y-0 left-2/3 w-px bg-white/70" />
						<div className="absolute inset-x-0 top-1/2 h-px bg-white/70" />
						<div className="absolute inset-x-0 top-2/3 h-24 rotate-[-8deg] bg-[#abcab3]/45" />
						<button
							type="button"
							disabled={disabled}
							aria-label="Bản đồ khu cắm trại"
							onClick={(event) => pickFromPointer(event.clientX, event.clientY)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onPick(DEFAULT_LATITUDE, DEFAULT_LONGITUDE);
								}
							}}
							className="absolute inset-0 cursor-crosshair bg-transparent disabled:cursor-not-allowed"
						/>
					</>
				)}
				{!styleUrl && (
					<div className="absolute top-3 left-3 max-w-[min(18rem,calc(100%-1.5rem))] rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-[#34483b] shadow-sm">
						Chưa cấu hình MapTiler key, đang dùng bản đồ fallback.
					</div>
				)}
				{mapError && (
					<div className="absolute top-3 left-3 max-w-[min(22rem,calc(100%-1.5rem))] rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm">
						{mapError}
					</div>
				)}

				{shouldUseFallback && (
					<button
						type="button"
						aria-label="Marker vị trí khu cắm trại"
						disabled={disabled}
						onClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => {
							if (disabled) {
								return;
							}

							event.currentTarget.setPointerCapture(event.pointerId);
							setIsDragging(true);
						}}
						onPointerMove={(event) => {
							if (isDragging) {
								pickFromPointer(event.clientX, event.clientY);
							}
						}}
						onPointerUp={(event) => {
							if (isDragging) {
								pickFromPointer(event.clientX, event.clientY);
							}

							setIsDragging(false);
							event.currentTarget.releasePointerCapture(event.pointerId);
						}}
						className="-translate-x-1/2 -translate-y-full absolute z-10 flex size-11 items-center justify-center rounded-full bg-[#164027] text-white shadow-lg ring-4 ring-white disabled:opacity-60"
						style={markerPosition}
					>
						<MapPin className="size-6" fill="currentColor" />
					</button>
				)}

				<div className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#34483b] shadow-sm">
					{hasLocation ? "Đã đặt marker" : "Click bản đồ để chọn vị trí"}
				</div>
			</div>

			<p className="mt-2 text-xs font-semibold text-[#667a6d]">
				Kéo ghim hoặc click bản đồ để điều chỉnh vị trí chính xác.
			</p>
		</div>
	);
}
