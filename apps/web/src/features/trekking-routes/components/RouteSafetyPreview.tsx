import type { ReactNode } from "react";
import { RouteSafetyPanel } from "../../route-safety/components/RouteSafetyPanel";
import { RouteSafetySummary } from "../../route-safety/components/RouteSafetySummary";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import type { GeoJsonLineString } from "../types";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

interface Props {
	geometry: GeoJsonLineString;
	routeId?: string;
	footer?: ReactNode;
	variant?: "card" | "embedded";
	showSummary?: boolean;
	showMapTitle?: boolean;
	mapHeightClassName?: string;
}

export function RouteSafetyPreview({
	geometry,
	routeId,
	footer,
	variant,
	showSummary,
	showMapTitle,
	mapHeightClassName,
}: Props) {
	const safety = useRouteSafety(geometry, routeId);
	// The route's own danger zones (Host-marked or added from a confirmed safety hotspot).
	const dangerZones = useRouteDangerZones(routeId);
	return (
		<div>
			<RouteGeometryPreview
				geometry={geometry}
				safetyFeatures={safety.data?.features}
				dangerZones={dangerZones.items}
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
			{showSummary && (
				<RouteSafetySummary
					data={safety.data?.features}
					sources={safety.sources ?? safety.data?.sources}
				/>
			)}
			{footer}
		</div>
	);
}
