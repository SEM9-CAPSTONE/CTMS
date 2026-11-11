import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { PayBookingRequest, PayBookingResponse } from "../types";

export const bookingPaymentService = {
	pay: (
		bookingId: string,
		input: PayBookingRequest,
		idempotencyKey: string
	): Promise<PayBookingResponse> =>
		httpClient.post<PayBookingResponse>(API_ENDPOINTS.BOOKINGS.PAY(bookingId), input, {
			headers: { "Idempotency-Key": idempotencyKey },
		}),
};
