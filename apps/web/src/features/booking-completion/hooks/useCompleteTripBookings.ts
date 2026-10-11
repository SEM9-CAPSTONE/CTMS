import { useCallback, useRef, useState } from "react";
import { bookingCompletionService } from "../services/booking-completion.service";
import type { BatchCompleteBookingsResponse, BookingCompletionError } from "../types";
import { mapBookingCompletionError } from "./booking-completion-error";

export function useCompleteTripBookings(onSuccess?: (res: BatchCompleteBookingsResponse) => void) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<BatchCompleteBookingsResponse | null>(null);
	const [error, setError] = useState<BookingCompletionError | null>(null);
	const inFlight = useRef(false);

	const completeTripBookings = useCallback(
		async (tripId: string): Promise<BatchCompleteBookingsResponse | null> => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const response = await bookingCompletionService.completeTripBookings(tripId);
				setResult(response);
				onSuccess?.(response);
				return response;
			} catch (err) {
				const mapped = mapBookingCompletionError(err);
				setError(mapped);
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[onSuccess]
	);

	const reset = useCallback(() => {
		setResult(null);
		setError(null);
	}, []);

	return {
		completeTripBookings,
		isSubmitting,
		result,
		error,
		reset,
	};
}
