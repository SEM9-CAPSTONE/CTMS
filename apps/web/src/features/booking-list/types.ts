import type {
	BookingPaymentStatus,
	BookingStatus,
	BookingTripPresentation,
} from "../booking-details/types";

export interface BookingListItem {
	id: string;
	tripId: string;
	numPeople: number | null;
	status: BookingStatus | null;
	paymentStatus: BookingPaymentStatus | null;
	holdExpiresAt: string | null;
	tripStartsAtSnapshot: string | null;
	tripEndsAtSnapshot: string | null;
	totalAmount: string | null;
	createdAt: string;
	tripPresentation: BookingTripPresentation | null;
}

export interface BookingListError {
	kind: "unauthenticated" | "forbidden" | "retryable" | "unexpected";
	message: string;
	canRetry: boolean;
}
