import { useCallback, useRef, useState } from "react";
import { bookingCompletionService } from "../services/booking-completion.service";
import type { BookingCompletionError, CompleteBookingResponse } from "../types";
import { mapBookingCompletionError } from "./booking-completion-error";

export function useCompleteBooking(onSuccess?: (res: CompleteBookingResponse) => void) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<CompleteBookingResponse | null>(null);
	const [error, setError] = useState<BookingCompletionError | null>(null);
	const inFlight = useRef(false);

	const completeBooking = useCallback(
		async (bookingId: string): Promise<CompleteBookingResponse | null> => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const response = await bookingCompletionService.completeBooking(bookingId);
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
		completeBooking,
		isSubmitting,
		result,
		error,
		reset,
	};
}
