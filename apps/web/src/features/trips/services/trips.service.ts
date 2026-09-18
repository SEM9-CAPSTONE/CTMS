import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CreateTripInput, Trip } from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),
};
