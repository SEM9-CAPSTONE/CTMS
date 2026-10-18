import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AvailablePortersQuery,
	AvailablePortersResponse,
	BookTripInput,
	BookTripResponse,
	CancelTripInput,
	ConfigureTripWaypointsInput,
	CreatePorterRequestInput,
	CreateTripInput,
	CreateTripWaypointInput,
	HostPorterAssignmentTrip,
	PaginatedTrips,
	PorterAssignedTrip,
	PorterRequest,
	PorterTripOperations,
	RescheduleTripInput,
	ReviewTripInput,
	SearchTripsQuery,
	Trip,
	TripBookingsResponse,
	TripDetails,
} from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),
	updateDraft: (tripId: string, input: CreateTripInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.UPDATE(tripId), input),
	configureWaypoints: (tripId: string, input: ConfigureTripWaypointsInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.CONFIGURE_WAYPOINTS(tripId), input),
	createWaypoint: (tripId: string, input: CreateTripWaypointInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.WAYPOINTS(tripId), input),
	updateWaypoint: (
		tripId: string,
		waypointId: string,
		input: CreateTripWaypointInput
	): Promise<Trip> => httpClient.put<Trip>(API_ENDPOINTS.TRIPS.WAYPOINT(tripId, waypointId), input),
	deleteWaypoint: (tripId: string, waypointId: string): Promise<Trip> =>
		httpClient.delete<Trip>(API_ENDPOINTS.TRIPS.WAYPOINT(tripId, waypointId)),
	submitForApproval: (tripId: string): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.SUBMIT_FOR_APPROVAL(tripId), {}),

	listPendingReview: (): Promise<Trip[]> =>
		httpClient.get<Trip[]>(API_ENDPOINTS.TRIPS.PENDING_REVIEW),

	review: (tripId: string, input: ReviewTripInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.REVIEW(tripId), input),

	reschedule: (tripId: string, input: RescheduleTripInput): Promise<TripDetails> =>
		httpClient.patch<TripDetails>(API_ENDPOINTS.TRIPS.RESCHEDULE(tripId), input),

	cancel: (tripId: string, input: CancelTripInput): Promise<TripDetails> =>
		httpClient.patch<TripDetails>(API_ENDPOINTS.TRIPS.CANCEL(tripId), input),

	search: (query?: SearchTripsQuery): Promise<PaginatedTrips> =>
		httpClient.get<PaginatedTrips>(
			API_ENDPOINTS.TRIPS.GET_ALL,
			query as Record<string, string | number | boolean | undefined> | undefined
		),

	getById: (tripId: string): Promise<TripDetails> =>
		httpClient.get<TripDetails>(API_ENDPOINTS.TRIPS.GET_BY_ID(tripId)),

	getAvailablePorters: (
		tripId: string,
		query: AvailablePortersQuery
	): Promise<AvailablePortersResponse> =>
		httpClient.get<AvailablePortersResponse>(API_ENDPOINTS.TRIPS.AVAILABLE_PORTERS(tripId), {
			role: query.role,
			minExperienceYears: query.minExperienceYears,
			page: query.page,
			limit: query.limit,
		}),

	createPorterRequest: (tripId: string, input: CreatePorterRequestInput): Promise<PorterRequest> =>
		httpClient.post<PorterRequest>(API_ENDPOINTS.TRIPS.PORTER_REQUESTS(tripId), input),

	listPorterRequests: (tripId: string): Promise<PorterRequest[]> =>
		httpClient.get<PorterRequest[]>(API_ENDPOINTS.TRIPS.PORTER_REQUESTS(tripId)),

	getPendingPorterRequest: async (
		tripId: string,
		porterId: string
	): Promise<PorterRequest | null> => {
		const request = await httpClient.get<PorterRequest | null>(
			API_ENDPOINTS.TRIPS.PENDING_PORTER_REQUEST(tripId),
			{ porterId }
		);
		return request ?? null;
	},

	getMyPorterRequests: (): Promise<PorterRequest[]> =>
		httpClient.get<PorterRequest[]>(API_ENDPOINTS.TRIPS.MY_PORTER_REQUESTS),

	getHostPorterRequests: (): Promise<PorterRequest[]> =>
		httpClient.get<PorterRequest[]>(API_ENDPOINTS.TRIPS.HOST_PORTER_REQUESTS),

	acceptPorterRequest: (requestId: string): Promise<PorterRequest> =>
		httpClient.patch<PorterRequest>(API_ENDPOINTS.TRIPS.ACCEPT_PORTER_REQUEST(requestId), {}),

	declinePorterRequest: (requestId: string): Promise<PorterRequest> =>
		httpClient.patch<PorterRequest>(API_ENDPOINTS.TRIPS.DECLINE_PORTER_REQUEST(requestId), {}),

	cancelPorterRequest: (tripId: string, requestId: string): Promise<PorterRequest> =>
		httpClient.patch<PorterRequest>(
			API_ENDPOINTS.TRIPS.CANCEL_PORTER_REQUEST(tripId, requestId),
			{}
		),

	getMyTrips: (): Promise<TripDetails[]> =>
		httpClient.get<TripDetails[]>(API_ENDPOINTS.TRIPS.GET_MINE),

	getPorterCandidateTrips: (): Promise<TripDetails[]> =>
		httpClient.get<TripDetails[]>(API_ENDPOINTS.TRIPS.GET_PORTER_CANDIDATES),

	getHostPorterAssignments: (): Promise<HostPorterAssignmentTrip[]> =>
		httpClient.get<HostPorterAssignmentTrip[]>(API_ENDPOINTS.TRIPS.GET_PORTER_ASSIGNMENTS),

	getAssignedTrips: (): Promise<PorterAssignedTrip[]> =>
		httpClient.get<PorterAssignedTrip[]>(API_ENDPOINTS.TRIPS.GET_ASSIGNED),
	getAssignedTripOperations: (tripId: string): Promise<PorterTripOperations> =>
		httpClient.get<PorterTripOperations>(API_ENDPOINTS.TRIPS.ASSIGNED_OPERATIONS(tripId)),

	book: (input: BookTripInput, idempotencyKey: string): Promise<BookTripResponse> =>
		httpClient.post<BookTripResponse>(API_ENDPOINTS.BOOKINGS.CREATE, input, {
			headers: { "Idempotency-Key": idempotencyKey },
		}),

	getTripBookings: (tripId: string): Promise<TripBookingsResponse> =>
		httpClient.get<TripBookingsResponse>(API_ENDPOINTS.TRIPS.BOOKINGS(tripId)),
};
