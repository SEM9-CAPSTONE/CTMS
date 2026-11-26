import "maplibre-gl/dist/maplibre-gl.css";
import { useMemo, useState } from "react";
import { RouteSafetyPanel } from "../../route-safety/components/RouteSafetyPanel";
import { SafetyDetailsModal } from "../../route-safety/components/SafetyDetailsModal";
import { SafetyMapFallback } from "../../route-safety/components/SafetyMapFallback";
import { VerifiedDangerZonesLayer } from "../../route-safety/components/VerifiedDangerZonesLayer";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useSafetyMapLayers } from "../../route-safety/hooks/useSafetyMapLayers";
import { excludeSafetyFeatures } from "../../route-safety/utils/verified-zone-map";
import { useRouteDrawing } from "../hooks/useRouteDrawing";
import { useRouteGeometryMap } from "../hooks/useRouteGeometryMap";
import type { GeoJsonLineString, RouteDrawing } from "../types";
import { approximateLengthMeters } from "../utils/route-import";
import { RouteDrawingControls } from "./RouteDrawingControls";
import { RouteGeometryFallback } from "./RouteGeometryFallback";
import { RouteGeometryToolbar } from "./RouteGeometryToolbar";

interface Props {
	value: GeoJsonLineString;
	disabled?: boolean;
	routeId?: string;
	initialDrawing?: RouteDrawing;
	onChange: (value: GeoJsonLineString, drawing?: RouteDrawing) => void;
	onBlockedChange?: (blocked: boolean) => void;
}

const EMPTY_GEOMETRY: GeoJsonLineString = { type: "LineString", coordinates: [] };

export function RouteGeometryEditor({
	value,
	disabled = false,
	onChange,
	routeId,
	initialDrawing,
	onBlockedChange,
}: Props) {
	const [selected, setSelected] = useState<number | null>(null);
	const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
	const drawing = useRouteDrawing({ value, initialDrawing, onChange, onBlockedChange });
	const map = useRouteGeometryMap(
		value,
		drawing.waypoints,
		disabled,
		drawing.updateWaypoints,
		setSelected
	);
	const safety = useRouteSafety(drawing.blocked ? EMPTY_GEOMETRY : value, routeId);
	const analyzedFeatures = useMemo(
		() => excludeSafetyFeatures(safety.data?.features, verifiedIds),
		[safety.data?.features, verifiedIds]
	);
	const details = useSafetyMapLayers(
		map.map,
		map.mapReady && !map.fallback,
		analyzedFeatures,
		false
	);
	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			{!map.fallback && details.feature && (
				<SafetyDetailsModal {...details} feature={details.feature} />
			)}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Vẽ tuyến đường</h2>
				</div>
				<p
					data-testid="preview-length"
					className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
				>
					{drawing.blocked ? "—" : `≈ ${approximateLengthMeters(value.coordinates).toFixed(0)} m`}
					{" · "}
					{drawing.waypoints.length} điểm
				</p>
			</div>
			<RouteDrawingControls {...drawing} disabled={disabled} />
			<div
				data-testid="route-map-surface"
				className="relative mt-4 h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
			>
				<div ref={map.containerRef} style={{ position: "absolute", inset: 0 }} />
				{map.fallback && (
					<RouteGeometryFallback
						value={value}
						waypoints={drawing.waypoints}
						disabled={disabled}
						selected={selected}
						containerRef={map.containerRef}
						onChange={drawing.updateWaypoints}
						onSelect={setSelected}
					/>
				)}
				{map.fallback && (
					<SafetyMapFallback
						areaClicksEnabled={false}
						data={analyzedFeatures}
						project={([lng, lat]) => [((lng + 180) / 360) * 100, ((90 - lat) / 180) * 100]}
					/>
				)}
				<VerifiedDangerZonesLayer
					map={map.map}
					ready={map.mapReady}
					fallback={map.fallback}
					bounds={{ west: -180, south: -90, east: 180, north: 90 }}
					project={([lng, lat]) => [((lng + 180) / 360) * 100, ((90 - lat) / 180) * 100]}
					areaClicksEnabled={false}
					onZoneIdsChange={setVerifiedIds}
				/>
				{map.fallback && (
					<span className="absolute top-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-amber-800">
						Không tải được bản đồ nền; đang dùng chế độ tọa độ dự phòng.
					</span>
				)}
				<RouteSafetyPanel
					data={safety.data}
					sources={safety.sources}
					valid={safety.valid}
					loading={safety.pending || safety.isFetching}
					error={safety.isError && !safety.pending && safety.valid}
					onRetry={() => void safety.refetch()}
				/>
			</div>
			{(!map.fallback || value.coordinates.length >= 2) && (
				<div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#667a6d]">
					<a href="https://www.maptiler.com/" target="_blank" rel="noreferrer">
						<img className="h-4" src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" />
					</a>
				</div>
			)}
			<RouteGeometryToolbar
				waypoints={drawing.waypoints}
				canUndo={drawing.canUndo}
				onUndo={drawing.undo}
				disabled={disabled}
				selected={selected}
				onRemove={drawing.remove}
				onClear={drawing.clear}
				onSelect={setSelected}
			/>
		</section>
	);
}
