import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BookingRefundInfo, ProcessRefundRequest, ProcessRefundResponse } from "../types";

export const bookingRefundService = {
	getRefundInfo: (bookingId: string): Promise<BookingRefundInfo> =>
		httpClient.get<BookingRefundInfo>(API_ENDPOINTS.BOOKINGS.REFUNDS(bookingId)),

	requestRefund: (
		bookingId: string,
		payload: ProcessRefundRequest,
		idempotencyKey?: string
	): Promise<ProcessRefundResponse> =>
		httpClient.post<ProcessRefundResponse>(
			API_ENDPOINTS.BOOKINGS.REFUNDS(bookingId),
			payload,
			idempotencyKey ? { headers: { "idempotency-key": idempotencyKey } } : undefined
		),

	processObligation: (
		bookingId: string,
		obligationId: string,
		idempotencyKey?: string
	): Promise<ProcessRefundResponse> =>
		httpClient.post<ProcessRefundResponse>(
			API_ENDPOINTS.BOOKINGS.PROCESS_REFUND_OBLIGATION(bookingId, obligationId),
			{},
			idempotencyKey ? { headers: { "idempotency-key": idempotencyKey } } : undefined
		),
};
