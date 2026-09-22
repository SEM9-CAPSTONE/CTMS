import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CreateTripInput, ReviewTripInput, Trip } from "../types";

export const tripsService = {
	create: (input: CreateTripInput): Promise<Trip> =>
		httpClient.post<Trip>(API_ENDPOINTS.TRIPS.CREATE, input),
	listPendingReview: (): Promise<Trip[]> =>
		httpClient.get<Trip[]>(API_ENDPOINTS.TRIPS.PENDING_REVIEW),
	review: (tripId: string, input: ReviewTripInput): Promise<Trip> =>
		httpClient.patch<Trip>(API_ENDPOINTS.TRIPS.REVIEW(tripId), input),
};
