import type { ReactNode } from "react";
import { RouteSafetyPanel } from "../../route-safety/components/RouteSafetyPanel";
import { RouteSafetySummary } from "../../route-safety/components/RouteSafetySummary";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
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
	return (
		<div>
			<RouteGeometryPreview
				geometry={geometry}
				safetyFeatures={safety.data?.features}
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
