import { type ReactNode, useMemo } from "react";
import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import type { TripDetails } from "../../trips/types";
import { useCamperRouteMap } from "../hooks/useCamperRouteMap";
import { CamperTripSummary } from "./CamperTripSummary";
import { OperationalRouteMap } from "./OperationalRouteMap";
const ignoreLocation = () => {};
const EMPTY_CHECKPOINTS: [] = [];
export function CamperOperationalMap({
	userId,
	trip,
	isBooked,
	navigation,
}: { userId: string; trip: TripDetails; isBooked: boolean; navigation?: ReactNode }) {
	const map = useCamperRouteMap(userId, isBooked ? trip.id : undefined);
	const geometry = useMemo<GeoJsonLineString>(() => {
		const points = [...(trip.waypoints ?? [])]
			.sort((a, b) => a.dayNumber - b.dayNumber || a.sequenceOrder - b.sequenceOrder)
			.map((item) => item.location.coordinates);
		return {
			type: "LineString",
			coordinates:
				points.length > 1 ? points : [trip.meetingPoint.coordinates, trip.meetingPoint.coordinates],
		};
	}, [trip.waypoints, trip.meetingPoint]);
	return (
		<div>
			<div className="relative">
				<CamperTripSummary trip={trip} />
				{navigation}
			</div>
			{isBooked ? (
				<>
					{map.isPending && <p className="p-4">Đang tải bản đồ tuyến...</p>}
					{map.isError && (
						<button type="button" onClick={() => void map.refetch()} className="p-4 underline">
							Không tải được bản đồ tuyến. Thử lại
						</button>
					)}
					{map.data && (
						<OperationalRouteMap route={map.data.route} meetingPoint={map.data.meetingPoint} />
					)}
				</>
			) : (
				<section className="p-4" aria-label={`Bản đồ lịch trình ${trip.title}`}>
					<h3 className="mb-3 font-bold">Bản đồ lịch trình · {trip.title}</h3>
					<RouteCheckpointMap
						geometry={geometry}
						checkpoints={EMPTY_CHECKPOINTS}
						selectedLocation={trip.meetingPoint}
						radiusMeters={0}
						disabled
						onSelectLocation={ignoreLocation}
					/>
					<p className="mt-2 text-xs text-[#627769]">
						Điểm tập trung và các điểm lịch trình công khai của chuyến đi.
					</p>
				</section>
			)}
		</div>
	);
}
