import { type ReactNode, useMemo } from "react";
import { RouteSafetyPanel } from "../../route-safety/components/RouteSafetyPanel";
import { RouteSafetySummary } from "../../route-safety/components/RouteSafetySummary";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import type { GeoJsonLineString, RouteCheckpoint, RouteDangerZone, RouteDrawing } from "../types";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

interface Props {
	geometry: GeoJsonLineString;
	routeId?: string;
	drawing?: RouteDrawing;
	review?: { checkpoints: RouteCheckpoint[]; dangerZones: RouteDangerZone[] };
	footer?: ReactNode;
	variant?: "card" | "embedded";
	showSummary?: boolean;
	showMapTitle?: boolean;
	mapHeightClassName?: string;
}

export function RouteSafetyPreview({
	geometry,
	routeId,
	drawing,
	review,
	footer,
	variant,
	showSummary,
	showMapTitle,
	mapHeightClassName,
}: Props) {
	const safety = useRouteSafety(geometry, routeId, Boolean(review));
	// The route's own danger zones (Host-marked or added from a confirmed safety hotspot).
	const dangerZones = useRouteDangerZones(review ? undefined : routeId);
	const waypoints = useMemo(() => {
		const coordinates = geometry.coordinates;
		return (
			drawing?.waypoints ??
			(coordinates.length > 1 ? [coordinates[0], coordinates[coordinates.length - 1]] : undefined)
		);
	}, [drawing, geometry.coordinates]);
	const hasManualSegments =
		drawing?.mode === "manual" ||
		(drawing?.mode === "hybrid" && drawing.segments.some((segment) => segment.mode === "manual"));
	return (
		<div>
			<RouteGeometryPreview
				geometry={geometry}
				safetyFeatures={safety.data?.features}
				dangerZones={review?.dangerZones ?? dangerZones.items}
				checkpoints={review?.checkpoints}
				waypoints={waypoints}
				variant={variant}
				showTitle={showMapTitle}
				heightClassName={mapHeightClassName}
				mapOverlay={
					<RouteSafetyPanel
						data={safety.data}
						sources={safety.sources}
						valid={safety.valid}
						loading={safety.pending || safety.isFetching}
						error={safety.isError && !safety.pending && safety.valid}
						onRetry={() => void safety.refetch()}
					/>
				}
			/>
			{hasManualSegments && (
				<p className="mt-2 text-sm text-amber-800">
					Tuyến có đoạn vẽ thủ công chưa được đối chiếu với dữ liệu đường đi.
				</p>
			)}
			{dangerZones.error && (
				<div
					role="alert"
					className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
				>
					<span>{dangerZones.error}</span>
					<button
						type="button"
						onClick={() => void dangerZones.reload()}
						className="shrink-0 font-bold underline"
					>
						Thử lại
					</button>
				</div>
			)}
			{showSummary && <RouteSafetySummary data={safety.data?.features} />}
			{footer}
		</div>
	);
}
