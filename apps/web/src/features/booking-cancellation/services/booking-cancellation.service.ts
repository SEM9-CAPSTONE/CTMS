import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CancelBookingRequest, CancelBookingResponse } from "../types";

export const bookingCancellationService = {
	cancel: (bookingId: string, input: CancelBookingRequest): Promise<CancelBookingResponse> =>
		httpClient.patch<CancelBookingResponse>(API_ENDPOINTS.BOOKINGS.CANCEL(bookingId), input),
};
