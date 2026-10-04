import type { BookingDetails } from "../booking-details/types";
import type { CancelBookingResponse } from "./types";

export const bookingFixture: BookingDetails = {
	id: "77777777-7777-4777-8777-777777777777",
	tripId: "33333333-3333-4333-8333-333333333333",
	userId: "owner",
	numPeople: 2,
	status: "confirmed",
	paymentStatus: "paid",
	holdExpiresAt: null,
	tripStartsAtSnapshot: "2030-01-01T00:00:00Z",
	tripEndsAtSnapshot: "2030-01-02T00:00:00Z",
	basePrice: "999.99",
	totalAmount: "999.99",
	cancellationPolicySnapshot: null,
	createdAt: "2029-01-01T00:00:00Z",
	tripPresentation: null,
	members: [],
	equipmentItems: [],
};

export const cancellationFixture: CancelBookingResponse = {
	bookingId: bookingFixture.id,
	status: "cancelled",
	paymentStatus: "paid",
	cancelledAt: "2029-12-01T00:00:00Z",
	refund: { obligationId: "refund-1", amount: "0.51", status: "pending" },
};
