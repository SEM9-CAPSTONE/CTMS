import { QueryClientContext } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useContext, useEffect, useMemo } from "react";
import { Button } from "../../../shared/components/Button";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import type { Position } from "../../trekking-routes/types";
import { VERIFIED_ZONE_SOURCE_ID } from "../constants";
import { useSafetyMapLayers } from "../hooks/useSafetyMapLayers";
import { useVerifiedDangerZones } from "../hooks/useVerifiedDangerZones";
import { safetyText } from "../messages";
import type { MapSafetyBounds } from "../types";
import { publishedZoneShape } from "../utils/verified-zone-map";
import { SafetyDetailsModal } from "./SafetyDetailsModal";
import { SafetyMapFallback } from "./SafetyMapFallback";

interface Props {
	map: MapLibreMap | null;
	ready: boolean;
	fallback: boolean;
	bounds: MapSafetyBounds;
	project: (position: Position) => Position;
	areaClicksEnabled?: boolean;
	onZoneIdsChange?: (ids: string[]) => void;
}

/** Standalone/public map surfaces can render without an authenticated application query context. */
export function VerifiedDangerZonesLayer(props: Props) {
	const client = useContext(QueryClientContext);
	const actor = getStoredAuthUser();
	if (!client || !actor) return null;
	return <VerifiedDangerZonesLayerContent key={actor.id} {...props} userId={actor.id} />;
}

function VerifiedDangerZonesLayerContent({
	map,
	ready,
	fallback,
	bounds,
	project,
	areaClicksEnabled = true,
	onZoneIdsChange,
	userId,
}: Props & { userId: string }) {
	const query = useVerifiedDangerZones(map, ready, fallback, bounds, userId);
	// Poll timestamps change independently of hazard facts; keep an open popup on unchanged data.
	const features = query.data?.features;
	const data = useMemo(
		() =>
			features
				? { type: "FeatureCollection" as const, features: features.map(publishedZoneShape) }
				: undefined,
		[features]
	);
	const ids =
		query.data?.features
			.map((feature) => feature.id)
			.sort()
			.join(",") ?? "";
	useEffect(() => {
		onZoneIdsChange?.(ids ? ids.split(",") : []);
	}, [ids, onZoneIdsChange]);
	const details = useSafetyMapLayers(
		map,
		ready && !fallback,
		data,
		areaClicksEnabled,
		VERIFIED_ZONE_SOURCE_ID
	);
	return (
		<>
			{!fallback && details.feature && (
				<SafetyDetailsModal {...details} feature={details.feature} />
			)}
			{fallback && (
				<SafetyMapFallback data={data} project={project} areaClicksEnabled={areaClicksEnabled} />
			)}
			{query.isError && (
				<div
					data-safety-ui
					className="absolute bottom-3 left-3 z-30 max-w-60 rounded-lg bg-white p-3 text-xs text-amber-900"
				>
					<p>{safetyText.verifiedZone.error}</p>
					<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
						Thử lại
					</Button>
				</div>
			)}
			{query.data?.truncated && !query.isError && (
				<p
					data-safety-ui
					className="absolute bottom-3 left-3 z-30 max-w-60 rounded-lg bg-white p-3 text-xs text-amber-900"
				>
					{safetyText.verifiedZone.truncated}
				</p>
			)}
		</>
	);
}
