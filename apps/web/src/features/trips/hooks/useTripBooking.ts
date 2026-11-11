import { useCallback, useEffect, useRef, useState } from "react";
import { mapBookingDetailsError } from "../../booking-details/hooks/useBookingDetails";
import { bookingDetailsService } from "../../booking-details/services/booking-details.service";
import type { BookingDetails, BookingDetailsError } from "../../booking-details/types";
import { mapBookingListError } from "../../booking-list/hooks/useBookingList";
import { bookingListService } from "../../booking-list/services/booking-list.service";

export function useTripBooking(tripId: string, enabled: boolean) {
	const [booking, setBooking] = useState<BookingDetails | null>(null);
	const [isLoading, setIsLoading] = useState(enabled);
	const [error, setError] = useState<BookingDetailsError | null>(null);
	const requestSequence = useRef(0);

	const load = useCallback(
		async (isSilent = false) => {
			const sequence = ++requestSequence.current;
			if (!enabled) {
				setBooking(null);
				setError(null);
				setIsLoading(false);
				return;
			}

			if (!isSilent) {
				setBooking(null);
				setError(null);
				setIsLoading(true);
			}
			try {
				// GET /bookings is owner-scoped and ordered newest first by the API.
				const bookings = await bookingListService.getMyBookings();
				const match = bookings.find((candidate) => candidate.tripId === tripId);
				if (!match) return;

				try {
					const details = await bookingDetailsService.getBookingDetails(match.id);
					if (sequence === requestSequence.current) setBooking(details);
				} catch (requestError) {
					if (sequence === requestSequence.current) setError(mapBookingDetailsError(requestError));
				}
			} catch (requestError) {
				if (sequence === requestSequence.current) {
					const listError = mapBookingListError(requestError);
					setError({
						kind: listError.kind === "unexpected" ? "unexpected" : listError.kind,
						message: listError.message,
						canRetry: listError.canRetry,
					});
				}
			} finally {
				if (sequence === requestSequence.current && !isSilent) setIsLoading(false);
			}
		},
		[enabled, tripId]
	);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { booking, isLoading, error, retry: load };
}
