import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import type { BookedTripRouteMap } from "../../trips/types";
const ignoreLocationSelection = () => {};
export function OperationalRouteMap({
	route,
	meetingPoint,
}: Pick<BookedTripRouteMap, "route" | "meetingPoint">) {
	if (!route) return <p className="p-5 text-sm">Chưa có dữ liệu tuyến đường của chuyến đi.</p>;
	return (
		<section className="p-4" aria-label={`Bản đồ tuyến ${route.name}`}>
			<h3 className="mb-3 font-bold">Bản đồ tuyến · {route.name}</h3>
			<RouteCheckpointMap
				geometry={route.geometry}
				checkpoints={route.checkpoints}
				dangerZones={route.dangerZones}
				selectedLocation={meetingPoint ?? undefined}
				radiusMeters={0}
				disabled
				onSelectLocation={ignoreLocationSelection}
			/>
		</section>
	);
}
