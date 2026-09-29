import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BookingDetails } from "../types";

export const bookingDetailsService = {
	getBookingDetails: (bookingId: string): Promise<BookingDetails> =>
		httpClient.get<BookingDetails>(API_ENDPOINTS.BOOKINGS.GET_BY_ID(bookingId)),
};
