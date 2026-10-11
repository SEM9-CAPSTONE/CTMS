import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BatchCompleteBookingsResponse, CompleteBookingResponse } from "../types";

export const bookingCompletionService = {
	completeBooking: (bookingId: string): Promise<CompleteBookingResponse> =>
		httpClient.post<CompleteBookingResponse>(API_ENDPOINTS.BOOKINGS.COMPLETE(bookingId)),

	completeTripBookings: (tripId: string): Promise<BatchCompleteBookingsResponse> =>
		httpClient.post<BatchCompleteBookingsResponse>(
			API_ENDPOINTS.BOOKINGS.COMPLETE_TRIP_BOOKINGS(tripId)
		),
};
