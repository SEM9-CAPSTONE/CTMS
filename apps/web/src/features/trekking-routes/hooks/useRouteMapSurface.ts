import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Position } from "../types";
import { DEFAULT_ROUTE_CENTER, getRouteMapStyleUrl } from "../utils/route-map";

type LoadHandler = (map: MapLibreMap) => void;
type ClickHandler = (event: MapMouseEvent) => void;

/** One native map per mounted surface; data changes do not recreate its WebGL context. */
export function useRouteMapSurface(
	onLoad: LoadHandler,
	onClick?: ClickHandler,
	center: Position = DEFAULT_ROUTE_CENTER
) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const loadRef = useRef(onLoad);
	const clickRef = useRef(onClick);
	const centerRef = useRef(center);
	const [map, setMap] = useState<MapLibreMap | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const [mapRendered, setMapRendered] = useState(false);
	const [mapError, setMapError] = useState("");
	const styleUrl = getRouteMapStyleUrl(import.meta.env.VITE_MAPTILER_API_KEY);
	const failed = Boolean(mapError);
	useEffect(() => {
		loadRef.current = onLoad;
		clickRef.current = onClick;
		centerRef.current = center;
	}, [onLoad, onClick, center]);

	useEffect(() => {
		const container = containerRef.current;
		if (!styleUrl || !container || failed) return;
		let disposed = false;
		let instance: MapLibreMap | undefined;
		let observer: ResizeObserver | undefined;
		setMapReady(false);
		setMapRendered(false);
		const fail = (message: string) => {
			if (disposed) return;
			setMapReady(false);
			setMapError(message);
		};
		void import("maplibre-gl")
			.then(({ Map: NativeMap, NavigationControl, setMaxParallelImageRequests }) => {
				if (disposed) return;
				setMaxParallelImageRequests(8);
				instance = new NativeMap({
					container,
					style: styleUrl,
					center: centerRef.current,
					zoom: 13,
					attributionControl: false,
					pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
					maxCanvasSize: [2048, 2048],
					maxTileCacheSize: 64,
					maxTileCacheZoomLevels: 2,
					cancelPendingTileRequestsWhileZooming: true,
					fadeDuration: 0,
				});
				const current = instance;
				// MapLibre 6 can return without a painter after emitting a synchronous GPU error.
				if (!current.painter) {
					fail("Không khởi tạo được bản đồ; đang dùng chế độ tọa độ dự phòng.");
					return;
				}
				setMap(current);
				current.addControl(new NavigationControl({ showCompass: false }), "top-right");
				current.once("idle", () => {
					if (!disposed) setMapRendered(true);
				});
				current.on("load", () => {
					if (disposed) return;
					loadRef.current(current);
					setMapReady(true);
				});
				current.on("click", (event) => clickRef.current?.(event));
				current.on("error", (event) => {
					// A failed tile must not discard an otherwise usable route map.
					if (!current.isStyleLoaded() && !("sourceId" in event) && !("tile" in event))
						fail("Không tải được bản đồ nền; đang dùng chế độ tọa độ dự phòng.");
				});
				current.on("webglcontextlost", () =>
					fail("Bộ nhớ đồ họa không đủ; đang dùng chế độ tọa độ dự phòng.")
				);
				if (typeof ResizeObserver !== "undefined") {
					observer = new ResizeObserver(() => {
						if (!disposed) current.resize();
					});
					observer.observe(container);
				}
			})
			.catch(() => fail("Không khởi tạo được bản đồ; đang dùng chế độ tọa độ dự phòng."));
		return () => {
			disposed = true;
			observer?.disconnect();
			try {
				instance?.remove();
			} catch {
				// A constructor that failed before allocating its painter cannot finish native cleanup.
			}
			// The constructor may have appended a canvas before throwing.
			container.replaceChildren();
			setMap(null);
		};
	}, [styleUrl, failed]);

	return {
		containerRef,
		map,
		mapReady,
		mapRendered,
		mapError,
		styleUrl,
		fallback: !styleUrl || failed,
	};
}
