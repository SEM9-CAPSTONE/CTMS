import "maplibre-gl/dist/maplibre-gl.css";
import { useState } from "react";
import { RouteSafetyPanel } from "../../route-safety/components/RouteSafetyPanel";
import { SafetyMapFallback } from "../../route-safety/components/SafetyMapFallback";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useSafetyMapLayers } from "../../route-safety/hooks/useSafetyMapLayers";
import { useRouteGeometryMap } from "../hooks/useRouteGeometryMap";
import type { GeoJsonLineString } from "../types";
import { approximateLengthMeters } from "../utils/route-import";
import { RouteGeometryFallback } from "./RouteGeometryFallback";
import { RouteGeometryToolbar } from "./RouteGeometryToolbar";

interface Props {
	value: GeoJsonLineString;
	disabled?: boolean;
	routeId?: string;
	onChange: (value: GeoJsonLineString) => void;
}

export function RouteGeometryEditor({ value, disabled = false, onChange, routeId }: Props) {
	const [selected, setSelected] = useState<number | null>(null);
	const map = useRouteGeometryMap(value, disabled, onChange, setSelected);
	const safety = useRouteSafety(value, routeId);
	useSafetyMapLayers(map.map, map.mapReady && !map.fallback, safety.data?.features);
	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Vẽ tuyến đường</h2>
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
				data-testid="route-map-surface"
				className="relative mt-4 h-96 overflow-hidden rounded-xl border border-[#cbd9ce] bg-[linear-gradient(135deg,#dcebdd,#f7faf5_48%,#cfe3da)]"
			>
				<div ref={map.containerRef} style={{ position: "absolute", inset: 0 }} />
				{map.fallback && (
					<RouteGeometryFallback
						value={value}
						disabled={disabled}
						selected={selected}
						containerRef={map.containerRef}
						onChange={onChange}
						onSelect={setSelected}
					/>
				)}
				{map.fallback && (
					<SafetyMapFallback
						data={safety.data?.features}
						project={([lng, lat]) => [((lng + 180) / 360) * 100, ((90 - lat) / 180) * 100]}
					/>
				)}
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
			<RouteGeometryToolbar
				value={value}
				disabled={disabled}
				selected={selected}
				onChange={onChange}
				onSelect={setSelected}
			/>
		</section>
	);
}
