import { useCallback, useEffect, useRef, useState } from "react";
import { bookingCancellationService } from "../services/booking-cancellation.service";
import type {
	BookingCancellationError,
	CancelBookingRequest,
	CancelBookingResponse,
} from "../types";
import { mapBookingCancellationError } from "./booking-cancellation-error";

export function useCancelBooking(bookingId: string) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<CancelBookingResponse | null>(null);
	const [error, setError] = useState<BookingCancellationError | null>(null);
	const generation = useRef(0);
	const inFlight = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Changing Booking identity must invalidate pending requests and reset state.
	useEffect(() => {
		inFlight.current = false;
		setIsSubmitting(false);
		setResult(null);
		setError(null);
		return () => {
			generation.current += 1;
		};
	}, [bookingId]);

	const submit = useCallback(
		async (input: CancelBookingRequest) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			const attempt = generation.current;
			setIsSubmitting(true);
			setError(null);
			try {
				const response = await bookingCancellationService.cancel(bookingId, {
					...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
				});
				if (attempt !== generation.current) return null;
				setResult(response);
				return response;
			} catch (requestError) {
				if (attempt === generation.current) setError(mapBookingCancellationError(requestError));
				return null;
			} finally {
				if (attempt === generation.current) {
					inFlight.current = false;
					setIsSubmitting(false);
				}
			}
		},
		[bookingId]
	);
	return { submit, isSubmitting, result: result?.bookingId === bookingId ? result : null, error };
}
