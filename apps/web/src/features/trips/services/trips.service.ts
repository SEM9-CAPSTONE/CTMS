import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CreateTripInput,
	PaginatedTrips,
	SearchTripsQuery,
	Trip,
	TripDetails,
} from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),

	search: (query?: SearchTripsQuery): Promise<PaginatedTrips> =>
		httpClient.get<PaginatedTrips>(
			API_ENDPOINTS.TRIPS.GET_ALL,
			query as Record<string, string | number | boolean | undefined> | undefined
		),

	getById: (tripId: string): Promise<TripDetails> =>
		httpClient.get<TripDetails>(API_ENDPOINTS.TRIPS.GET_BY_ID(tripId)),

	getMyTrips: (): Promise<TripDetails[]> =>
		httpClient.get<TripDetails[]>(API_ENDPOINTS.TRIPS.GET_MINE),
};
