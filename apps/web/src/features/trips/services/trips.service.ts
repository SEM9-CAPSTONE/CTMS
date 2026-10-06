import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	BookTripInput,
	BookTripResponse,
	ConfigureTripWaypointsInput,
	CreateTripInput,
	PaginatedTrips,
	PorterAssignedTrip,
	ReviewTripInput,
	SearchTripsQuery,
	Trip,
	TripDetails,
} from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),
	updateDraft: (tripId: string, input: CreateTripInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.UPDATE(tripId), input),
	configureWaypoints: (tripId: string, input: ConfigureTripWaypointsInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.CONFIGURE_WAYPOINTS(tripId), input),

	listPendingReview: (): Promise<Trip[]> =>
		httpClient.get<Trip[]>(API_ENDPOINTS.TRIPS.PENDING_REVIEW),

	review: (tripId: string, input: ReviewTripInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.REVIEW(tripId), input),

	search: (query?: SearchTripsQuery): Promise<PaginatedTrips> =>
		httpClient.get<PaginatedTrips>(
			API_ENDPOINTS.TRIPS.GET_ALL,
			query as Record<string, string | number | boolean | undefined> | undefined
		),

	getById: (tripId: string): Promise<TripDetails> =>
		httpClient.get<TripDetails>(API_ENDPOINTS.TRIPS.GET_BY_ID(tripId)),

	getMyTrips: (): Promise<TripDetails[]> =>
		httpClient.get<TripDetails[]>(API_ENDPOINTS.TRIPS.GET_MINE),

	getAssignedTrips: (): Promise<PorterAssignedTrip[]> =>
		httpClient.get<PorterAssignedTrip[]>(API_ENDPOINTS.TRIPS.GET_ASSIGNED),

	book: (input: BookTripInput, idempotencyKey: string): Promise<BookTripResponse> =>
		httpClient.post<BookTripResponse>(API_ENDPOINTS.BOOKINGS.CREATE, input, {
			headers: { "Idempotency-Key": idempotencyKey },
		}),
};
