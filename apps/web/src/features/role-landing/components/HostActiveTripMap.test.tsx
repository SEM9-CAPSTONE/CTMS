import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import type { ActiveTripMap } from "../types/active-trip-map";
import { HostActiveTripMap } from "./HostActiveTripMap";

const trip: ActiveTripMap = {
	id: "trip",
	route: {
		name: "Khám phá bán đảo Sơn Trà",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.28, 16.1],
				[108.31, 16.12],
			],
		},
		checkpoints: [],
		dangerZones: [
			{
				id: "zone",
				routeId: "route",
				geometry: { type: "Point", coordinates: [108.3, 16.11] },
				radiusMeters: 50,
				severity: "high",
				description: "Lối mòn sát mép vực ở Dốc Vọng Cảnh",
				createdAt: "2026-11-16T00:00:00Z",
				updatedAt: "2026-11-16T00:00:00Z",
			},
		],
	},
	participants: [],
};
vi.mock("../../trekking-routes/components/RouteCheckpointMap", () => ({
	RouteCheckpointMap: vi.fn(() => <div />),
}));
vi.mock("./HostMonitoringRoster", () => ({ HostMonitoringRoster: () => null }));
vi.mock("../hooks/useHostTripMonitoring", () => ({
	useHostTripMonitoring: () => ({
		maps: { isPending: false, isError: false },
		trip,
		geometry: trip.route.geometry,
		markers: [],
	}),
}));
it("passes the live trip's route danger zones to the shared map", () => {
	render(
		<HostActiveTripMap hostId="host" tripId="trip" onSelect={vi.fn()} onRefreshTrips={vi.fn()} />
	);
	expect(vi.mocked(RouteCheckpointMap).mock.calls[0][0]).toMatchObject({
		geometry: trip.route.geometry,
		checkpoints: trip.route.checkpoints,
		dangerZones: trip.route.dangerZones,
		disabled: true,
	});
});
