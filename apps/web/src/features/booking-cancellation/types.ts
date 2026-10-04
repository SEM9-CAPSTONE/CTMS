import type { BookingPaymentStatus } from "../booking-details/types";

export interface CancelBookingRequest {
	reason?: string;
}

export interface CancelBookingResponse {
	bookingId: string;
	status: "cancelled";
	cancelledAt: string | null;
	paymentStatus: BookingPaymentStatus | null;
	refund: {
		obligationId: string;
		amount: string;
		status: "pending" | "succeeded" | "failed";
	} | null;
}

export interface BookingCancellationError {
	kind:
		| "unauthenticated"
		| "forbidden"
		| "not_found"
		| "conflict"
		| "validation"
		| "uncertain"
		| "unexpected";
	message: string;
	reasonError?: string;
}
