export interface CompleteBookingResponse {
	id: string;
	status: string;
	completedAt: string;
}

export interface BatchCompleteBookingsResponse {
	tripId: string;
	totalBookings: number;
	completedCount: number;
	skippedCount: number;
	completedBookingIds: string[];
}

export interface BookingCompletionError {
	kind: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "validation" | "uncertain";
	message: string;
	canRetry: boolean;
}
