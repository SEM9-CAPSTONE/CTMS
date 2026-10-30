import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SafetyMapFallback } from "../../route-safety/components/SafetyMapFallback";
import { useSafetyMapLayers } from "../../route-safety/hooks/useSafetyMapLayers";
import type { SafetyCollection } from "../../route-safety/types";
import { useRoutePreviewMap } from "../hooks/useRoutePreviewMap";
import type { GeoJsonLineString, RouteCheckpoint, RouteDangerZone } from "../types";
import { EMPTY_CHECKPOINTS, EMPTY_DANGER_ZONES, fallbackCoordinate } from "../utils/route-preview";
import { RoutePreviewFallback } from "./RoutePreviewFallback";
import { RoutePreviewLegends } from "./RoutePreviewLegends";

interface RouteGeometryPreviewProps {
	geometry: GeoJsonLineString;
	safetyFeatures?: SafetyCollection;
	checkpoints?: RouteCheckpoint[];
	dangerZones?: RouteDangerZone[];
	footer?: ReactNode;
	mapOverlay?: ReactNode;
	showTitle?: boolean;
	heightClassName?: string;
	/** "embedded" drops the card frame so the preview can sit inside another card. */
	variant?: "card" | "embedded";
}

export function RouteGeometryPreview({
	geometry,
	safetyFeatures,
	checkpoints: providedCheckpoints,
	dangerZones: providedDangerZones,
	footer,
	mapOverlay,
	showTitle = true,
	heightClassName = "h-96",
	variant = "card",
}: RouteGeometryPreviewProps) {
	const checkpoints = providedCheckpoints ?? EMPTY_CHECKPOINTS;
	const dangerZones = providedDangerZones ?? EMPTY_DANGER_ZONES;
	const {
		containerRef,
		map,
		mapReady,
		mapRendered,
		mapError,
		styleUrl,
		fallback: useFallback,
		bounds,
		fitAll,
	} = useRoutePreviewMap(geometry, checkpoints, dangerZones);
	useSafetyMapLayers(map, mapReady && !useFallback, safetyFeatures);

	return (
		<section
			className={
				variant === "card"
					? "rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
					: undefined
			}
		>
			{showTitle && (
				<h2 className="flex items-center gap-2 font-extrabold text-[#10221b]">
					<MapIcon className="size-5 text-[#34483b]" aria-hidden="true" />
					Xem trước đường đi của tuyến
				</h2>
			)}
			<div
				data-testid="route-geometry-preview"
				aria-busy={!useFallback && !mapRendered}
				className={`relative overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)] ${showTitle ? "mt-4" : ""} ${heightClassName}`}
			>
				<div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
				{useFallback && (
					<RoutePreviewFallback
						geometry={geometry}
						checkpoints={checkpoints}
						dangerZones={dangerZones}
						bounds={bounds}
					/>
				)}
				{!styleUrl && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-[#34483b]">
						Bản đồ nền chưa khả dụng; đang hiển thị đường tuyến.
					</span>
				)}
				{mapError && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
						{mapError}
					</span>
				)}
				<RoutePreviewLegends checkpoints={checkpoints} dangerZones={dangerZones} />
				{useFallback && (
					<SafetyMapFallback
						data={safetyFeatures}
						project={(position) => fallbackCoordinate(position, bounds)}
					/>
				)}
				{mapReady && !useFallback && (
					<button
						type="button"
						aria-label="Xem toàn tuyến"
						title="Xem toàn tuyến"
						onClick={() => {
							fitAll();
						}}
						className="absolute right-3 top-24 z-10 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#10221b] shadow"
					>
						Xem toàn tuyến
					</button>
				)}
				{mapOverlay}
			</div>
			{footer}
		</section>
	);
}
