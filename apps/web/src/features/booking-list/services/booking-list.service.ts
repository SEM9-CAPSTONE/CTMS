import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BookingListItem } from "../types";

export const bookingListService = {
	getMyBookings: (): Promise<BookingListItem[]> =>
		httpClient.get<BookingListItem[]>(API_ENDPOINTS.BOOKINGS.GET_ALL),
};
