import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import type { TripDetails } from "../../trips/types";
import { useHostTripMap } from "../hooks/useHostTripMap";

const ignoreLocationSelection = () => {};

export function HostTripMap({
	hostId,
	trip,
}: {
	hostId: string;
	trip: TripDetails;
}) {
	const mapQuery = useHostTripMap(hostId, trip.routeId);
	if (!trip.routeId) return <p>Chưa có dữ liệu tuyến đường của chuyến đi.</p>;
	if (mapQuery.isPending) return <output>Đang tải bản đồ chuyến đi...</output>;
	if (mapQuery.isError)
		return (
			<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
				<p>Không thể tải bản đồ chuyến đi.</p>
				<Button variant="ghost" onClick={() => void mapQuery.refetch()} className="mt-2 font-bold">
					Thử lại bản đồ
				</Button>
			</div>
		);
	return (
		<section aria-label={`Bản đồ chuyến đi ${trip.title}`} className="space-y-2">
			<h4 className="font-bold">Bản đồ chuyến đi · {mapQuery.data.route.name}</h4>
			<RouteCheckpointMap
				geometry={mapQuery.data.route.geometry}
				checkpoints={mapQuery.data.checkpoints}
				selectedLocation={trip.meetingPoint}
				radiusMeters={0}
				disabled
				showFitRouteControl={false}
				onSelectLocation={ignoreLocationSelection}
			/>
		</section>
	);
}
import { Button } from "../../../shared/components/Button";
