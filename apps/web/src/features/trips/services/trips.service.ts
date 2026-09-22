import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ConfigureTripWaypointsInput, CreateTripInput, Trip } from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),
	configureWaypoints: (tripId: string, input: ConfigureTripWaypointsInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.CONFIGURE_WAYPOINTS(tripId), input),
};
